/**
 * Offline batch-sync (§3.11). Draait binnen de FamilyRoom-DO, dus mutaties van
 * één gezin lopen strikt na elkaar. Per-mutatie idempotentie via KV op de
 * client-`key`: replay geeft exact hetzelfde resultaat terug (nooit dubbele
 * punten). Afgewezen mutaties krijgen een foutcode; de app toont die vriendelijk.
 */
import type { SyncMutation } from "@taakhelden/shared";
import { ErrorCodes } from "@taakhelden/shared";
import type { Env } from "../types";
import { ApiException } from "../middleware/error";
import { applyComplete, applyUndo, applyRedeem, applyAttachPhoto, type Actor } from "./pointsEngine";
import { getFamily } from "../repo/families";
import { listForDate, type InstanceRow } from "../repo/instances";
import { entriesSince } from "../repo/ledger";
import { listRewards } from "../repo/rewards";
import { localDate } from "./time";

export interface SyncResult {
  key: string;
  status: "applied" | "rejected";
  points?: number;
  newBalance?: number;
  code?: string;
  message?: string;
}

type Broadcast = (event: string, data: unknown) => void;

const SYNC_KEY_TTL = 60 * 60 * 24 * 7; // 7 d — ruim genoeg voor offline apparaten

async function applyOne(
  env: Env,
  familyId: string,
  actor: Actor,
  m: SyncMutation,
  broadcast: Broadcast,
): Promise<SyncResult> {
  const db = env.DB;
  switch (m.op) {
    case "complete": {
      const { result, status, childId } = await applyComplete(db, familyId, m.instanceId, actor);
      broadcast("instance.updated", { instanceId: m.instanceId, status, childId });
      if (result.pointsEarned > 0) broadcast("points.changed", { childId, newBalance: result.newBalance });
      return {
        key: m.key,
        status: "applied",
        points: result.pointsEarned + result.photoBonusPoints,
        newBalance: result.newBalance,
      };
    }
    case "undo": {
      const { status, childId } = await applyUndo(db, familyId, m.instanceId, actor);
      broadcast("instance.updated", { instanceId: m.instanceId, status, childId });
      return { key: m.key, status: "applied" };
    }
    case "redeem": {
      if (actor.role !== "child") {
        throw new ApiException(403, ErrorCodes.FORBIDDEN, "Alleen kinderen kunnen beloningen kopen.");
      }
      const { result, childId } = await applyRedeem(db, familyId, m.rewardId, actor);
      broadcast("redemption.created", { redemptionId: result.redemptionId, rewardId: m.rewardId, childId });
      broadcast("points.changed", { childId, newBalance: result.newBalance });
      return { key: m.key, status: "applied", newBalance: result.newBalance };
    }
    case "attach_photo": {
      const r = await applyAttachPhoto(db, familyId, m.instanceId, m.photoId, actor);
      broadcast("instance.updated", { instanceId: m.instanceId, childId: r.childId, photoStatus: r.photoStatus });
      if (r.photoBonusPoints > 0) broadcast("points.changed", { childId: r.childId, newBalance: r.newBalance });
      return { key: m.key, status: "applied", points: r.photoBonusPoints, newBalance: r.newBalance };
    }
  }
}

export async function processSyncBatch(
  env: Env,
  familyId: string,
  actor: Actor,
  mutations: SyncMutation[],
  since: string | undefined,
  broadcast: Broadcast,
): Promise<{ results: SyncResult[]; changes: unknown; serverTime: string }> {
  const results: SyncResult[] = [];

  for (const m of mutations) {
    const kvKey = `sync:${actor.userId}:${m.key}`;
    const cached = await env.KV.get(kvKey);
    if (cached) {
      results.push(JSON.parse(cached) as SyncResult); // idempotent: exact hetzelfde resultaat
      continue;
    }
    let result: SyncResult;
    try {
      result = await applyOne(env, familyId, actor, m, broadcast);
    } catch (err) {
      if (err instanceof ApiException) {
        // Conflictregel "afgevinkt wint": een al-afgevinkte taak is geen fout die
        // de app hoeft te tonen, maar we melden 'm wél zodat de client bijwerkt.
        result = { key: m.key, status: "rejected", code: err.code, message: err.message };
      } else {
        throw err; // onverwachte fout: laat de hele batch falen (500)
      }
    }
    // Ook afwijzingen cachen: opnieuw insturen mag nooit alsnog dubbel boeken.
    await env.KV.put(kvKey, JSON.stringify(result), { expirationTtl: SYNC_KEY_TTL });
    results.push(result);
  }

  const changes = await collectChanges(env, familyId, actor, since);
  return { results, changes, serverTime: new Date().toISOString() };
}

/**
 * Delta sinds `since`: ledger-entries (created_at > since) en de dag-instances
 * van de aanroeper. Instances hebben geen updated_at, dus we sturen de volledige
 * dag terug — klein genoeg, en de app reconcilieert op instance-id.
 */
async function collectChanges(env: Env, familyId: string, actor: Actor, since: string | undefined) {
  const db = env.DB;
  const family = (await getFamily(db, familyId)) as unknown as { timezone: string } | null;
  const today = localDate(family?.timezone ?? "Europe/Amsterdam");
  const sinceIso = since ?? "1970-01-01T00:00:00Z";

  const isChild = actor.role === "child";
  const [ledgerRows, instanceRows, rewardRows] = await Promise.all([
    entriesSince(db, familyId, sinceIso, isChild ? actor.userId : undefined),
    listForDate(db, familyId, today, isChild ? actor.userId : undefined),
    listRewards(db, familyId),
  ]);

  return {
    instances: (instanceRows as unknown as InstanceRow[]).map((r) => ({
      id: r.id,
      taskId: r.task_id,
      childId: r.child_id,
      date: r.date,
      status: r.status,
      pointsEarned: r.points_earned ?? null,
      photoStatus: r.photo_status ?? null,
    })),
    ledger: ledgerRows.map((r) => ({
      id: r.id,
      childId: r.child_id,
      type: r.type,
      amount: r.amount,
      ref: r.ref_id ?? null,
      at: r.created_at,
    })),
    rewards: rewardRows.map((r) => ({ id: r.id, title: r.title, icon: r.icon, price: r.price })),
  };
}
