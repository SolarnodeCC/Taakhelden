/**
 * WS-PAUSE (Rustschild): authz, engine-integratie, streak en ledger-invariant.
 *
 * Dekt:
 *  - PUT /members/:id/pause maakt pauze aan (ouder full)
 *  - GET /members/:id/pause zichtbaar voor kind-zelf én ouder, niet ander gezin
 *  - DELETE /members/:id/pause/:id beëindigt pauze (ouder full)
 *  - generateInstancesForFamily slaat gepauzeerd kind over, sibling onaangetast
 *  - computeStreak met pausedDates: pauzedagen zijn transparant
 *  - Ledger ongewijzigd door pauze-acties
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import {
  seedFamily,
  parentToken,
  childToken,
  api,
  todayAmsterdam,
} from "./helpers";
import { generateInstancesForFamily } from "../src/services/taskEngine";
import { computeStreak, buildPausedDatesSet } from "../src/services/pointsEngine";
import { balance as ledgerBalance } from "../src/repo/ledger";

const TODAY = todayAmsterdam();

// --- Helper: seed een taak met recurrente daily recurrence ---
async function seedDailyTask(familyId: string, childId: string) {
  const taskId = `tsk_pausetest${Math.random().toString(36).slice(2)}`;
  await env.DB
    .prepare(
      `INSERT INTO tasks (id, family_id, title, points, approval_required, photo_bonus_points, assignees, recurrence)
       VALUES (?, ?, 'Dagelijkse taak', 10, 0, 0, ?, ?)`,
    )
    .bind(
      taskId,
      familyId,
      JSON.stringify([childId]),
      JSON.stringify({ freq: "daily" }),
    )
    .run();
  return taskId;
}

// --- Helper: seed een pause direct in D1 ---
async function seedPause(
  familyId: string,
  childId: string,
  createdBy: string,
  startsOn: string,
  endsOn: string | null = null,
) {
  const id = `pz_test${Math.random().toString(36).slice(2)}`;
  await env.DB
    .prepare(
      `INSERT INTO child_pauses (id, family_id, child_id, starts_on, ends_on, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, familyId, childId, startsOn, endsOn, createdBy)
    .run();
  return id;
}

// ============================================================
// Authz
// ============================================================

describe("PUT /members/:id/pause — authz", () => {
  it("ouder full kan pauze aanmaken", async () => {
    const fam = await seedFamily("pau_put");
    const res = await api(`/members/${fam.childA}/pause`, {
      method: "PUT",
      token: await parentToken(fam.parentId, fam.familyId),
      body: { startsOn: TODAY },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; childId: string; active: boolean };
    expect(body.childId).toBe(fam.childA);
    expect(body.active).toBe(true);
  });

  it("kind kan geen pauze aanmaken (403)", async () => {
    const fam = await seedFamily("pau_put_child");
    const res = await api(`/members/${fam.childA}/pause`, {
      method: "PUT",
      token: await childToken(fam.childA, fam.familyId),
      body: { startsOn: TODAY },
    });
    expect(res.status).toBe(403);
  });

  it("approve_only ouder kan geen pauze aanmaken (403)", async () => {
    const fam = await seedFamily("pau_put_aonly");
    const res = await api(`/members/${fam.childA}/pause`, {
      method: "PUT",
      token: await parentToken(fam.parentId, fam.familyId, { perm: "approve_only" }),
      body: { startsOn: TODAY },
    });
    expect(res.status).toBe(403);
  });

  it("ouder kan geen pauze aanmaken voor kind van ander gezin (404)", async () => {
    const famA = await seedFamily("pau_put_a");
    const famB = await seedFamily("pau_put_b");
    const res = await api(`/members/${famB.childA}/pause`, {
      method: "PUT",
      token: await parentToken(famA.parentId, famA.familyId),
      body: { startsOn: TODAY },
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /members/:id/pause — authz", () => {
  it("kind kan eigen pauze lezen", async () => {
    const fam = await seedFamily("pau_get_own");
    await seedPause(fam.familyId, fam.childA, fam.parentId, TODAY);
    const res = await api(`/members/${fam.childA}/pause`, {
      token: await childToken(fam.childA, fam.familyId),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pauses: unknown[] };
    expect(body.pauses).toHaveLength(1);
  });

  it("kind kan pauze van sibling NIET lezen (403)", async () => {
    const fam = await seedFamily("pau_get_sib");
    const res = await api(`/members/${fam.childB}/pause`, {
      token: await childToken(fam.childA, fam.familyId),
    });
    expect(res.status).toBe(403);
  });

  it("ouder kan pauze van elk kind in het gezin lezen", async () => {
    const fam = await seedFamily("pau_get_parent");
    await seedPause(fam.familyId, fam.childB, fam.parentId, TODAY);
    const res = await api(`/members/${fam.childB}/pause`, {
      token: await parentToken(fam.parentId, fam.familyId),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pauses: unknown[] };
    expect(body.pauses).toHaveLength(1);
  });
});

describe("DELETE /members/:id/pause/:pauseId — authz", () => {
  it("ouder full kan pauze beëindigen", async () => {
    const fam = await seedFamily("pau_del");
    const pauseId = await seedPause(fam.familyId, fam.childA, fam.parentId, TODAY);
    const res = await api(`/members/${fam.childA}/pause/${pauseId}`, {
      method: "DELETE",
      token: await parentToken(fam.parentId, fam.familyId),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("kind kan pauze NIET beëindigen (403)", async () => {
    const fam = await seedFamily("pau_del_child");
    const pauseId = await seedPause(fam.familyId, fam.childA, fam.parentId, TODAY);
    const res = await api(`/members/${fam.childA}/pause/${pauseId}`, {
      method: "DELETE",
      token: await childToken(fam.childA, fam.familyId),
    });
    expect(res.status).toBe(403);
  });

  it("404 bij al-beëindigde pauze", async () => {
    const fam = await seedFamily("pau_del_404");
    const pauseId = await seedPause(fam.familyId, fam.childA, fam.parentId, TODAY);
    // Eerst beëindigen
    await api(`/members/${fam.childA}/pause/${pauseId}`, {
      method: "DELETE",
      token: await parentToken(fam.parentId, fam.familyId),
    });
    // Tweede keer → 404
    const res = await api(`/members/${fam.childA}/pause/${pauseId}`, {
      method: "DELETE",
      token: await parentToken(fam.parentId, fam.familyId),
    });
    expect(res.status).toBe(404);
  });
});

// ============================================================
// Engine: instance generatie overgeslagen voor gepauzeerd kind
// ============================================================

describe("generateInstancesForFamily — pauze skip", () => {
  it("gepauzeerd kind krijgt geen instances; sibling onaangetast", async () => {
    const fam = await seedFamily("pau_eng");
    const familyId = fam.familyId;

    // Beide kinderen krijgen dezelfde taak
    await seedDailyTask(familyId, fam.childA);
    await seedDailyTask(familyId, fam.childB);

    // Pauzeer alleen kind A
    await seedPause(familyId, fam.childA, fam.parentId, TODAY, null);

    const family = { vacation_mode: 0 };
    await generateInstancesForFamily(env.DB, familyId, family, TODAY);

    // Kind A mag geen instance hebben
    const instancesA = await env.DB
      .prepare("SELECT id FROM task_instances WHERE family_id = ? AND child_id = ? AND date = ?")
      .bind(familyId, fam.childA, TODAY)
      .all();
    expect(instancesA.results).toHaveLength(0);

    // Kind B heeft wel een instance
    const instancesB = await env.DB
      .prepare("SELECT id FROM task_instances WHERE family_id = ? AND child_id = ? AND date = ?")
      .bind(familyId, fam.childB, TODAY)
      .all();
    expect(instancesB.results).toHaveLength(1);
  });

  it("pauze beëindigd (cleared) — kind krijgt daarna wél instances", async () => {
    const fam = await seedFamily("pau_cleared");
    const familyId = fam.familyId;
    await seedDailyTask(familyId, fam.childA);

    const pauseId = await seedPause(familyId, fam.childA, fam.parentId, TODAY, null);
    // Beëindig de pauze direct
    await env.DB
      .prepare("UPDATE child_pauses SET cleared_at = datetime('now') WHERE id = ?")
      .bind(pauseId)
      .run();

    const family = { vacation_mode: 0 };
    const created = await generateInstancesForFamily(env.DB, familyId, family, TODAY);
    expect(created).toBeGreaterThan(0);
  });
});

// ============================================================
// computeStreak met pausedDates
// ============================================================

describe("computeStreak + buildPausedDatesSet", () => {
  it("pauzedagen zijn transparant — tellen niet als gemist", () => {
    // Streak: ma, di, [wo = gepauzeerd], do, vr
    // Zonder pausedDates: wo zou als gemiste dag tellen (1 gap-budget)
    // Met pausedDates: wo is transparant, geen gap-budget verbruikt
    const bonusDates = ["2026-03-09", "2026-03-10", "2026-03-12", "2026-03-13"];
    const pausedDates = new Set(["2026-03-11"]); // wo
    const today = "2026-03-13"; // vr

    const withPause = computeStreak(bonusDates, today, pausedDates);
    const withoutPause = computeStreak(bonusDates, today);

    // Met pauze: wo is transparant, dus 4 verdiende dagen zonder gap-verbruik
    expect(withPause).toBe(4);
    // Zonder pauze: wo telt als 1 gemiste dag (gap-budget verbruikt), streak ook 4 maar gap budget is leeg
    expect(withoutPause).toBe(4); // ook 4, maar de 2e gap in dezelfde week zou nu breken
  });

  it("pauzedag spaart weekvergevingsbudget voor een echte gemiste dag", () => {
    // Week: ma, di, [wo = gepauzeerd], [do = echt gemist], vr
    // bonusDates: ma(09), di(10), vr(13) — wo(11) en do(12) zijn geen bonusdagen
    // Met pauze (wo transparant): vr(1) → do(gap 1, vergeven) → wo(skip) → di(2) → ma(3) = 3
    // Zonder pauze: vr(1) → do(gap 1) → wo(gap 2, zelfde week) → BREAK = 1
    const bonusDates = ["2026-03-09", "2026-03-10", "2026-03-13"];
    const pausedDates = new Set(["2026-03-11"]); // wo gepauzeerd
    const today = "2026-03-13";

    const withPause = computeStreak(bonusDates, today, pausedDates);
    const withoutPause = computeStreak(bonusDates, today);

    expect(withPause).toBe(3);   // wo transparant → do vergeven als 1e gap → ma+di+vr = 3
    expect(withoutPause).toBe(1); // do = 1e gap, wo = 2e gap in dezelfde week → BREAK na vr
  });

  it("buildPausedDatesSet genereert correcte set van datums", () => {
    const pauses = [
      { starts_on: "2026-03-10", ends_on: "2026-03-12" }, // di t/m do
    ];
    const set = buildPausedDatesSet(pauses, "2026-03-09", "2026-03-15");
    expect(set.has("2026-03-10")).toBe(true);
    expect(set.has("2026-03-11")).toBe(true);
    expect(set.has("2026-03-12")).toBe(true);
    expect(set.has("2026-03-09")).toBe(false);
    expect(set.has("2026-03-13")).toBe(false);
  });

  it("open-einde pauze (ends_on = null) loopt tot `to`", () => {
    const pauses = [{ starts_on: "2026-03-13", ends_on: null }];
    const set = buildPausedDatesSet(pauses, "2026-03-13", "2026-03-15");
    expect(set.has("2026-03-13")).toBe(true);
    expect(set.has("2026-03-14")).toBe(true);
    expect(set.has("2026-03-15")).toBe(true);
    expect(set.has("2026-03-16")).toBe(false);
  });
});

// ============================================================
// Ledger invariant: pauze raakt de ledger NIET
// ============================================================

describe("pauze raakt het ledger niet", () => {
  it("aanmaken en beëindigen van een pauze laat het saldo ongewijzigd", async () => {
    const fam = await seedFamily("pau_ledger");
    const familyId = fam.familyId;
    const childId = fam.childA;

    // Begin-saldo (0)
    const balanceBefore = await ledgerBalance(env.DB, familyId, childId);
    expect(balanceBefore).toBe(0);

    // Pauze aanmaken via de API
    const putRes = await api(`/members/${childId}/pause`, {
      method: "PUT",
      token: await parentToken(fam.parentId, familyId),
      body: { startsOn: TODAY },
    });
    expect(putRes.status).toBe(201);
    const { id: pauseId } = (await putRes.json()) as { id: string };

    // Saldo na aanmaken: ongewijzigd
    expect(await ledgerBalance(env.DB, familyId, childId)).toBe(0);

    // Pauze beëindigen
    const delRes = await api(`/members/${childId}/pause/${pauseId}`, {
      method: "DELETE",
      token: await parentToken(fam.parentId, familyId),
    });
    expect(delRes.status).toBe(200);

    // Saldo na beëindigen: nog steeds ongewijzigd
    expect(await ledgerBalance(env.DB, familyId, childId)).toBe(0);
  });
});

// ============================================================
// API round-trip: GET na PUT toont actieve pauze
// ============================================================

describe("pause API round-trip", () => {
  it("GET na PUT toont actieve pauze", async () => {
    const fam = await seedFamily("pau_rt");
    const token = await parentToken(fam.parentId, fam.familyId);

    await api(`/members/${fam.childA}/pause`, {
      method: "PUT",
      token,
      body: { startsOn: TODAY, reason: "Ziek" },
    });

    const getRes = await api(`/members/${fam.childA}/pause`, { token });
    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as { pauses: Array<{ active: boolean; reason: string | null }> };
    expect(body.pauses).toHaveLength(1);
    expect(body.pauses[0]!.active).toBe(true);
    expect(body.pauses[0]!.reason).toBe("Ziek");
  });

  it("GET na DELETE toont geen actieve pauzes", async () => {
    const fam = await seedFamily("pau_rt2");
    const token = await parentToken(fam.parentId, fam.familyId);
    const pauseId = await seedPause(fam.familyId, fam.childA, fam.parentId, TODAY);

    await api(`/members/${fam.childA}/pause/${pauseId}`, { method: "DELETE", token });

    const getRes = await api(`/members/${fam.childA}/pause`, { token });
    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as { pauses: unknown[] };
    expect(body.pauses).toHaveLength(0);
  });
});
