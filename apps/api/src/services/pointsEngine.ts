/**
 * Puntenlogica — draait ALTIJD binnen de FamilyRoom-DO (serialisatie per gezin).
 * Regels (zie CLAUDE.md):
 *  - saldo = som van points_ledger, nooit een los veld
 *  - dag/weekbonus transactioneel bij de laatste kwalificerende complete
 *  - nooit negatief behalve redemption
 */
import { ErrorCodes, type CompleteResult, type RedeemResult } from "@taakhelden/shared";
import { ApiException } from "../middleware/error";
import { getFamily } from "../repo/families";
import { getTask } from "../repo/tasks";
import * as instances from "../repo/instances";
import * as ledger from "../repo/ledger";
import * as rewards from "../repo/rewards";
import * as photos from "../repo/photos";
import * as badges from "../repo/badges";
import * as pauses from "../repo/pauses";
import { qualifyingBadgeIds } from "./badges";
import { newId } from "./ids";
import { localDate, weekDates, weekKey, yesterdayOf, localMidnightUtc, addDays } from "./time";

const UNDO_WINDOW_MS = 5 * 60 * 1000;

export interface Actor {
  userId: string;
  role: "parent" | "child";
}

interface FamilyRow {
  timezone: string;
  day_bonus_points: number;
  week_bonus_points: number;
  week_bonus_threshold: number;
}

async function loadInstanceOr404(db: D1Database, familyId: string, instanceId: string) {
  const inst = await instances.getInstance(db, familyId, instanceId);
  if (!inst) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Deze taak kennen we niet.");
  }
  return inst;
}

function requireOwnInstance(actor: Actor, childId: string) {
  if (actor.role === "child" && actor.userId !== childId) {
    throw new ApiException(403, ErrorCodes.FORBIDDEN, "Dit is niet jouw taak.");
  }
}

/**
 * Boekt punten + bonussen voor een goedgekeurde instance en geeft het
 * confetti-pakket terug. Alleen aanroepen als de instance zojuist op
 * 'approved' is gezet.
 */
async function bookPoints(
  db: D1Database,
  familyId: string,
  family: FamilyRow,
  inst: instances.InstanceRow,
  task: { points: number; photo_bonus_points: number },
): Promise<CompleteResult> {
  const taskPoints = task.points;
  await ledger.insertEntry(db, familyId, {
    childId: inst.child_id,
    type: "task",
    amount: taskPoints,
    refId: inst.id,
  });

  // Foto-bonus: als er (al) een foto aan deze instance hangt. Hangt de foto er
  // nog niet, dan boekt applyAttachPhoto de bonus zodra het kind 'm koppelt.
  let photoBonusPoints = 0;
  if (
    task.photo_bonus_points > 0 &&
    inst.photo_key &&
    !(await ledger.bonusExists(db, familyId, inst.child_id, "photo_bonus", inst.id))
  ) {
    await ledger.insertEntry(db, familyId, {
      childId: inst.child_id,
      type: "photo_bonus",
      amount: task.photo_bonus_points,
      refId: inst.id,
    });
    photoBonusPoints = task.photo_bonus_points;
  }

  // Dag- en weekbonus-tellingen zijn onafhankelijke reads (beide alleen tegen
  // task_instances, niet tegen het ledger) — parallel ophalen scheelt een
  // D1-round trip binnen de DO-serialisatie per gezin.
  const [day, week] = await Promise.all([
    instances.dayStats(db, familyId, inst.child_id, inst.date),
    instances.weekStats(db, familyId, inst.child_id, weekDates(inst.date)),
  ]);

  // Dagbonus: alle taken van deze dag afgerond én nog niet eerder geboekt.
  let dayBonusEarned = false;
  if (
    day.total > 0 &&
    day.approved === day.total &&
    !(await ledger.bonusExists(db, familyId, inst.child_id, "day_bonus", inst.date))
  ) {
    await ledger.insertEntry(db, familyId, {
      childId: inst.child_id,
      type: "day_bonus",
      amount: family.day_bonus_points,
      refId: inst.date,
    });
    dayBonusEarned = true;
  }

  // Weekbonus: de cron genereert de hele week vooruit, dus het weektotaal is
  // compleet en de bonus kan elke dag vallen zodra de drempel gehaald is
  // (niet meer alleen op zondag). Weeksleutel als ref_id → max één per week.
  let weekBonusEarned = false;
  const ref = weekKey(inst.date);
  if (
    week.total > 0 &&
    week.approved / week.total >= family.week_bonus_threshold &&
    !(await ledger.bonusExists(db, familyId, inst.child_id, "week_bonus", ref))
  ) {
    await ledger.insertEntry(db, familyId, {
      childId: inst.child_id,
      type: "week_bonus",
      amount: family.week_bonus_points,
      refId: ref,
    });
    weekBonusEarned = true;
  }

  const newBalance = await ledger.balance(db, familyId, inst.child_id);
  const newBadges = await awardBadges(db, familyId, family, inst.child_id, newBalance);

  return {
    pointsEarned: taskPoints,
    photoBonusPoints,
    dayBonusEarned,
    weekBonusEarned,
    newBadges,
    newBalance,
  };
}

/**
 * Kent, in dezelfde transactie als de boeking, de badges toe waarvoor het kind
 * nu (nieuw) kwalificeert en geeft ze terug voor de confetti-response.
 */
async function awardBadges(
  db: D1Database,
  familyId: string,
  family: FamilyRow,
  childId: string,
  balance: number,
): Promise<CompleteResult["newBadges"]> {
  const today = localDate(family.timezone);
  const bonusDates = await ledger.dayBonusDates(db, familyId, childId);
  const streakDays = computeStreak(bonusDates, today);

  const stats = await badges.collectStats(db, familyId, childId, streakDays, balance);
  const earned = await badges.listEarnedIds(db, familyId, childId);
  const candidates = qualifyingBadgeIds(stats).filter((id) => !earned.has(id));

  // Onafhankelijke inserts (elk zijn eigen PK) — parallel toekennen, volgorde
  // van `candidates` blijft behouden voor de confetti-response.
  const outcomes = await Promise.all(candidates.map((id) => badges.award(db, familyId, childId, id)));
  const awarded = candidates.filter((_, i) => outcomes[i]);
  if (awarded.length === 0) return [];

  const rows = await badges.getBadges(db, awarded);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return awarded
    .map((id) => byId.get(id))
    .filter((b): b is badges.BadgeRow => b !== undefined)
    .map((b) => ({ id: b.id, title: b.title, icon: b.icon }));
}

/** Afvinken (kind: eigen taak, ouder: elke taak in het gezin). */
export async function applyComplete(
  db: D1Database,
  familyId: string,
  instanceId: string,
  actor: Actor,
): Promise<{ result: CompleteResult; status: string; childId: string }> {
  const inst = await loadInstanceOr404(db, familyId, instanceId);
  requireOwnInstance(actor, inst.child_id);

  if (inst.status === "approved" || inst.status === "completed" || inst.status === "submitted") {
    throw new ApiException(409, ErrorCodes.TASK_ALREADY_COMPLETED, "Deze taak is al afgevinkt.", {
      instanceId: inst.id,
    });
  }

  const task = await getTask(db, familyId, inst.task_id);
  const family = (await getFamily(db, familyId)) as unknown as FamilyRow;
  if (!task || !family) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Deze taak kennen we niet.");
  }

  const now = new Date().toISOString();
  if (task.approval_required) {
    // Wachten op goedkeuring: punten volgen pas bij approve.
    await instances.setStatus(db, familyId, instanceId, {
      status: "submitted",
      completedAt: now,
    });
    return {
      status: "submitted",
      childId: inst.child_id,
      result: {
        pointsEarned: 0,
        photoBonusPoints: 0,
        dayBonusEarned: false,
        weekBonusEarned: false,
        newBadges: [],
        newBalance: await ledger.balance(db, familyId, inst.child_id),
      },
    };
  }

  const points = task.points as number;
  await instances.setStatus(db, familyId, instanceId, {
    status: "approved",
    pointsEarned: points,
    completedAt: now,
    approvedAt: now,
    approvedBy: actor.role === "parent" ? actor.userId : null,
  });
  const result = await bookPoints(
    db, familyId, family, { ...inst, date: inst.date },
    task as { points: number; photo_bonus_points: number },
  );
  return { status: "approved", childId: inst.child_id, result };
}

/** Goedkeuren door ouder: punten definitief in het ledger. */
export async function applyApprove(
  db: D1Database,
  familyId: string,
  instanceId: string,
  actor: Actor,
): Promise<{ result: CompleteResult; status: string; childId: string }> {
  const inst = await loadInstanceOr404(db, familyId, instanceId);
  if (inst.status === "approved") {
    throw new ApiException(409, ErrorCodes.TASK_ALREADY_COMPLETED, "Deze taak is al goedgekeurd.");
  }
  if (inst.status !== "submitted" && inst.status !== "completed") {
    throw new ApiException(409, ErrorCodes.INVALID_STATUS, "Deze taak is nog niet afgevinkt.");
  }

  const task = await getTask(db, familyId, inst.task_id);
  const family = (await getFamily(db, familyId)) as unknown as FamilyRow;
  if (!task || !family) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Deze taak kennen we niet.");
  }

  const points = task.points as number;
  await instances.setStatus(db, familyId, instanceId, {
    status: "approved",
    pointsEarned: points,
    approvedAt: new Date().toISOString(),
    approvedBy: actor.userId,
  });
  const result = await bookPoints(
    db, familyId, family, inst,
    task as { points: number; photo_bonus_points: number },
  );
  return { status: "approved", childId: inst.child_id, result };
}

/** Redo: vriendelijk terug naar open_redo. GEEN puntenaftrek (architectuurregel 4). */
export async function applyRedo(
  db: D1Database,
  familyId: string,
  instanceId: string,
  note: string,
): Promise<{ status: string; childId: string }> {
  const inst = await loadInstanceOr404(db, familyId, instanceId);
  if (inst.status !== "submitted" && inst.status !== "completed") {
    throw new ApiException(409, ErrorCodes.INVALID_STATUS, "Deze taak wacht niet op goedkeuring.");
  }
  await instances.setStatus(db, familyId, instanceId, { status: "open_redo", redoNote: note });
  // Kindmelding bij redo (notifier.childCopy.redo) is bewust nog niet gekoppeld
  // hier; ledger-mutatie zelf is compleet en punt-neutraal (architectuurregel 4).
  return { status: "open_redo", childId: inst.child_id };
}

/** Oeps-knop: binnen 5 min ongedaan maken, zolang niet goedgekeurd. */
export async function applyUndo(
  db: D1Database,
  familyId: string,
  instanceId: string,
  actor: Actor,
): Promise<{ status: string; childId: string }> {
  const inst = await loadInstanceOr404(db, familyId, instanceId);
  requireOwnInstance(actor, inst.child_id);
  if (inst.status === "approved") {
    // Goedgekeurd = punten geboekt; terugboeken mag niet (regel 4).
    throw new ApiException(409, ErrorCodes.TASK_ALREADY_COMPLETED, "Deze taak is al goedgekeurd.");
  }
  if (inst.status !== "completed" && inst.status !== "submitted") {
    throw new ApiException(409, ErrorCodes.INVALID_STATUS, "Deze taak staat nog gewoon open.");
  }
  if (!inst.completed_at || Date.now() - new Date(inst.completed_at).getTime() > UNDO_WINDOW_MS) {
    throw new ApiException(409, ErrorCodes.UNDO_WINDOW_EXPIRED, "De oeps-knop werkt tot 5 minuten na het afvinken.");
  }
  await instances.reopenInstance(db, familyId, instanceId);
  return { status: "open", childId: inst.child_id };
}

/** Handmatige bijboeking door ouder — alleen positief (architectuurregel 4). */
export async function applyAdjust(
  db: D1Database,
  familyId: string,
  input: { childId: string; amount: number; note: string },
): Promise<{ newBalance: number }> {
  if (input.amount <= 0) {
    throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Alleen positieve bijboekingen zijn mogelijk.");
  }
  await ledger.insertEntry(db, familyId, {
    childId: input.childId,
    type: "adjustment",
    amount: input.amount,
    note: input.note,
  });
  return { newBalance: await ledger.balance(db, familyId, input.childId) };
}

/**
 * Foto-bonus koppelen (kind, eigen taak) na de presigned-flow uit §3.6.
 * Is de instance al approved (taken zonder approvalRequired), dan boeken we de
 * bonus direct; anders volgt hij transactioneel bij approve (via bookPoints).
 */
export async function applyAttachPhoto(
  db: D1Database,
  familyId: string,
  instanceId: string,
  photoId: string,
  actor: Actor,
): Promise<{ childId: string; photoStatus: string; photoBonusPoints: number; newBalance: number }> {
  const inst = await loadInstanceOr404(db, familyId, instanceId);
  requireOwnInstance(actor, inst.child_id);
  if (inst.status === "open") {
    throw new ApiException(409, ErrorCodes.INVALID_STATUS, "Vink de taak eerst af, dan de foto erbij!");
  }

  const photo = await photos.getPhoto(db, familyId, photoId);
  if (!photo || photo.owner_id !== actor.userId || photo.purpose !== "task" || photo.ref_id !== instanceId) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Foto niet gevonden.");
  }
  if (photo.status === "intent" || photo.status === "failed") {
    throw new ApiException(409, ErrorCodes.INVALID_STATUS, "Upload de foto eerst.");
  }

  const photoStatus = photo.status === "ready" ? "ready" : "processing";
  await instances.setPhoto(db, familyId, instanceId, { photoKey: photo.r2_key, photoStatus });

  let photoBonusPoints = 0;
  const task = await getTask(db, familyId, inst.task_id);
  const bonus = (task?.photo_bonus_points as number) ?? 0;
  if (
    inst.status === "approved" &&
    bonus > 0 &&
    !(await ledger.bonusExists(db, familyId, inst.child_id, "photo_bonus", inst.id))
  ) {
    await ledger.insertEntry(db, familyId, {
      childId: inst.child_id,
      type: "photo_bonus",
      amount: bonus,
      refId: inst.id,
    });
    photoBonusPoints = bonus;
  }

  return {
    childId: inst.child_id,
    photoStatus,
    photoBonusPoints,
    newBalance: await ledger.balance(db, familyId, inst.child_id),
  };
}

/**
 * Beloning kopen (kind). De enige plek — naast annulering hieronder — waar een
 * negatief ledger-bedrag is toegestaan (architectuurregel 4).
 */
export async function applyRedeem(
  db: D1Database,
  familyId: string,
  rewardId: string,
  actor: Actor,
): Promise<{ result: RedeemResult; childId: string; rewardTitle: string }> {
  const reward = await rewards.getReward(db, familyId, rewardId);
  if (!reward || reward.archived_at) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Deze beloning bestaat niet (meer).");
  }
  const childId = actor.userId; // route staat alleen kinderen toe

  const balance = await ledger.balance(db, familyId, childId);
  if (balance < reward.price) {
    throw new ApiException(
      409,
      ErrorCodes.INSUFFICIENT_POINTS,
      "Nog even doorsparen — je bent er bijna!",
      { balance, price: reward.price },
    );
  }

  if (reward.limit_per_week !== null) {
    const family = (await getFamily(db, familyId)) as unknown as { timezone: string };
    const monday = weekDates(localDate(family.timezone))[0]!;
    const sinceUtc = localMidnightUtc(family.timezone, monday);
    const used = await rewards.countRedemptionsSince(db, familyId, childId, rewardId, sinceUtc);
    if (used >= reward.limit_per_week) {
      throw new ApiException(
        409,
        ErrorCodes.REWARD_LIMIT_REACHED,
        "Deze beloning is op voor deze week — volgende week weer een kans!",
      );
    }
  }

  const redemptionId = newId("rd");
  await rewards.insertRedemption(db, familyId, { id: redemptionId, rewardId, childId });
  await ledger.insertEntry(db, familyId, {
    childId,
    type: "redemption",
    amount: -reward.price,
    refId: redemptionId,
  });

  return {
    childId,
    rewardTitle: reward.title,
    result: {
      redemptionId,
      rewardId,
      price: reward.price,
      status: "pending",
      newBalance: await ledger.balance(db, familyId, childId),
    },
  };
}

/** Inlossing afhandelen (ouder): pending → fulfilled. Geen ledger-mutatie. */
export async function applyFulfillRedemption(
  db: D1Database,
  familyId: string,
  redemptionId: string,
  actor: Actor,
): Promise<{ status: string; childId: string }> {
  const redemption = await rewards.getRedemption(db, familyId, redemptionId);
  if (!redemption) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Inlossing niet gevonden.");
  }
  if (redemption.status !== "pending") {
    throw new ApiException(409, ErrorCodes.INVALID_STATUS, "Deze inlossing is al afgehandeld.");
  }
  await rewards.setRedemptionStatus(db, familyId, redemptionId, {
    status: "fulfilled",
    handledBy: actor.userId,
  });
  return { status: "fulfilled", childId: redemption.child_id };
}

/** Annuleren (ouder): punten terug via tegenboeking — de enige toegestane 'correctie'. */
export async function applyCancelRedemption(
  db: D1Database,
  familyId: string,
  redemptionId: string,
  actor: Actor,
): Promise<{ status: string; childId: string; newBalance: number }> {
  const redemption = await rewards.getRedemption(db, familyId, redemptionId);
  if (!redemption) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Inlossing niet gevonden.");
  }
  if (redemption.status === "cancelled") {
    throw new ApiException(409, ErrorCodes.INVALID_STATUS, "Deze inlossing is al geannuleerd.");
  }
  await rewards.setRedemptionStatus(db, familyId, redemptionId, {
    status: "cancelled",
    handledBy: actor.userId,
  });
  await ledger.insertEntry(db, familyId, {
    childId: redemption.child_id,
    type: "redemption_cancel",
    amount: redemption.price,
    refId: redemptionId,
  });
  return {
    status: "cancelled",
    childId: redemption.child_id,
    newBalance: await ledger.balance(db, familyId, redemption.child_id),
  };
}

/** Balance-object voor GET /points/balance en /instances/today. */
export async function computeBalance(
  db: D1Database,
  familyId: string,
  family: { timezone: string; week_bonus_threshold: number },
  childId: string,
) {
  const today = localDate(family.timezone);
  const [bal, day, week, bonusDates, lifetimeEarned, activePauses] = await Promise.all([
    ledger.balance(db, familyId, childId),
    instances.dayStats(db, familyId, childId, today),
    instances.weekStats(db, familyId, childId, weekDates(today)),
    ledger.dayBonusDates(db, familyId, childId),
    ledger.lifetimeEarned(db, familyId, childId),
    pauses.listActivePausesFor(db, familyId, childId),
  ]);

  // Bouw een set van gepauzeerde datums voor de laatste 60 dagen zodat
  // computeStreak de pauzes transparant kan overslaan.
  const pausedDates =
    activePauses.length > 0
      ? buildPausedDatesSet(activePauses, addDays(today, -60), today)
      : undefined;

  return {
    childId,
    balance: bal,
    todayCompleted: day.approved,
    todayTotal: day.total,
    weekProgress: week.total === 0 ? 0 : week.approved / week.total,
    streakDays: computeStreak(bonusDates, today, pausedDates),
    lifetimeEarned,
  };
}

/**
 * Aaneengesloten dagen met dagbonus, eindigend vandaag of gisteren.
 * (`bonusDates` in willekeurige volgorde; alleen de datums tellen).
 *
 * Streakbescherming (productbelofte): per ISO-kalenderweek (ma t/m zo, zie
 * `weekKey`) mag één dag zonder dagbonus overgeslagen worden zonder dat de
 * streak breekt. Een tweede gemiste dag in diezelfde week breekt de streak wél.
 * Een overgeslagen dag telt zelf niet mee in het aantal streakdagen — hij is
 * vergeven, niet verdiend.
 *
 * Eén open dag vandaag breekt de streak niet en kost géén weekvergeving: de dag
 * is nog niet voorbij. De streak loopt dan t/m gisteren.
 *
 * Vakantiemodus staat hier los van (dat is een gezinsinstelling).
 *
 * `pausedDates`: dagen waarop het kind gepauzeerd was (WS-PAUSE). Een gepauzeerde
 * dag is noch verdiend, noch een gemiste dag — hij wordt transparant overgeslagen
 * zonder het weekvergevingsbudget te consumeren.
 */
export function computeStreak(
  bonusDates: string[],
  today: string,
  pausedDates?: Set<string>,
): number {
  if (bonusDates.length === 0) return 0;
  const earned = new Set(bonusDates);
  const oldest = bonusDates.reduce((min, date) => (date < min ? date : min));

  // Start gisteren als vandaag nog niet verdiend is (dag is nog bezig) of gepauzeerd.
  let cursor = earned.has(today) ? today : yesterdayOf(today);
  let streak = 0;
  const gapsPerWeek = new Map<string, number>();

  while (cursor >= oldest) {
    if (pausedDates?.has(cursor)) {
      // Gepauzeerde dag: transparant — telt niet als earned, ook niet als gemiste dag.
      cursor = yesterdayOf(cursor);
      continue;
    }
    if (earned.has(cursor)) {
      streak++;
    } else {
      const week = weekKey(cursor);
      const gapsThisWeek = gapsPerWeek.get(week) ?? 0;
      if (gapsThisWeek >= 1) break; // tweede gemiste dag in deze week: streak stopt hier
      gapsPerWeek.set(week, gapsThisWeek + 1);
    }
    cursor = yesterdayOf(cursor);
  }
  return streak;
}

/**
 * Bouw een Set van gepauzeerde datums voor een kind op basis van actieve pauzes.
 * Wordt gebruikt door computeBalance en computeStreak.
 * `from` is inclusief; `to` is inclusief.
 */
export function buildPausedDatesSet(
  activePauses: Array<{ starts_on: string; ends_on: string | null }>,
  from: string,
  to: string,
): Set<string> {
  const result = new Set<string>();
  for (const p of activePauses) {
    let cur = p.starts_on < from ? from : p.starts_on;
    const end = p.ends_on === null ? to : p.ends_on < to ? p.ends_on : to;
    while (cur <= end) {
      result.add(cur);
      cur = addDays(cur, 1);
    }
  }
  return result;
}
