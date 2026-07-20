/**
 * Vervolg-surface (§3.2, §3.10, weekbonus):
 *  - POST /families/me/parents (tweede verzorger)
 *  - GET/PATCH /notification-settings
 *  - /devices + APNs 410-opschoning
 *  - hele-week-generatie + weekbonus op elke dag
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { seedFamily, seedTask, seedInstance, parentToken, childToken, api, todayAmsterdam } from "./helpers";
import { generateWeekAheadForFamily } from "../src/services/taskEngine";
import { weekDates } from "../src/services/time";

describe("POST /families/me/parents", () => {
  it("full-ouder nodigt een tweede verzorger uit (201 + pending profiel + token)", async () => {
    const fam = await seedFamily("inv");
    const res = await api("/families/me/parents", {
      token: await parentToken(fam.parentId, fam.familyId),
      body: { email: "mede@ouder.nl", permissions: "approve_only" },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { userId: string; inviteToken: string; permissions: string };
    expect(body.inviteToken).toBeTruthy();
    expect(body.permissions).toBe("approve_only");

    const row = await env.DB
      .prepare("SELECT role, permissions, email, password_hash FROM users WHERE id = ?")
      .bind(body.userId)
      .first<{ role: string; permissions: string; email: string; password_hash: string | null }>();
    expect(row?.role).toBe("parent");
    expect(row?.email).toBe("mede@ouder.nl");
    expect(row?.password_hash).toBeNull(); // pending tot de uitnodiging geaccepteerd is
    expect(await env.KV.get(`parentinvite:${body.inviteToken}`)).toBeTruthy();
  });

  it("dubbel e-mailadres → 409", async () => {
    const fam = await seedFamily("inv2");
    const token = await parentToken(fam.parentId, fam.familyId);
    await api("/families/me/parents", { token, body: { email: "dubbel@ouder.nl" } });
    const again = await api("/families/me/parents", { token, body: { email: "dubbel@ouder.nl" } });
    expect(again.status).toBe(409);
  });

  it("uitnodigen met het e-mailadres van een verwijderde gebruiker → 409 (geen 500)", async () => {
    const fam = await seedFamily("invdel");
    const row = await env.DB
      .prepare("SELECT email FROM users WHERE id = ?")
      .bind(fam.parentId)
      .first<{ email: string }>();
    await env.DB.prepare("UPDATE users SET deleted_at = datetime('now') WHERE id = ?").bind(fam.parentId).run();

    const res = await api("/families/me/parents", {
      token: await parentToken(fam.parentId, fam.familyId),
      body: { email: row!.email },
    });
    expect(res.status).toBe(409);
  });

  it("approve_only-ouder mag niemand uitnodigen (403)", async () => {
    const fam = await seedFamily("inv3");
    const res = await api("/families/me/parents", {
      token: await parentToken(fam.parentId, fam.familyId, { perm: "approve_only" }),
      body: { email: "x@ouder.nl" },
    });
    expect(res.status).toBe(403);
  });

  it("kind mag niemand uitnodigen (403)", async () => {
    const fam = await seedFamily("inv4");
    const res = await api("/families/me/parents", {
      token: await childToken(fam.childA, fam.familyId),
      body: { email: "x@ouder.nl" },
    });
    expect(res.status).toBe(403);
  });
});

describe("notification-settings", () => {
  it("GET geeft standaarden; PATCH zet een kind uit", async () => {
    const fam = await seedFamily("ntf");
    const token = await parentToken(fam.parentId, fam.familyId);

    const get = await api("/notification-settings", { token });
    expect(get.status).toBe(200);
    const body = (await get.json()) as { settings: Array<{ childId: string; enabled: boolean; quietStart: string | null }> };
    expect(body.settings.length).toBe(2);
    expect(body.settings.every((s) => s.enabled)).toBe(true); // standaard: aan
    expect(body.settings[0]!.quietStart).toBeNull();

    const patch = await api("/notification-settings", {
      method: "PATCH",
      token,
      body: { childId: fam.childA, enabled: false, quietStart: "20:00", quietEnd: "07:30" },
    });
    expect(patch.status).toBe(200);
    expect(((await patch.json()) as { enabled: boolean }).enabled).toBe(false);

    const after = await api("/notification-settings", { token });
    const childA = ((await after.json()) as { settings: Array<{ childId: string; enabled: boolean; quietStart: string | null }> })
      .settings.find((s) => s.childId === fam.childA)!;
    expect(childA.enabled).toBe(false);
    expect(childA.quietStart).toBe("20:00");
  });

  it("kind heeft geen toegang (403) en onbekend kind → 404", async () => {
    const fam = await seedFamily("ntf2");
    const child = await api("/notification-settings", { token: await childToken(fam.childA, fam.familyId) });
    expect(child.status).toBe(403);

    const unknown = await api("/notification-settings", {
      method: "PATCH",
      token: await parentToken(fam.parentId, fam.familyId),
      body: { childId: "ch_bestaatniet", enabled: false },
    });
    expect(unknown.status).toBe(404);
  });
});

// (devices + APNs worden in main afgedekt door test/devices.test.ts)

describe("weekgeneratie + weekbonus elke dag", () => {
  it("generateWeekAheadForFamily maakt instances voor vandaag t/m einde week", async () => {
    const fam = await seedFamily("wkg");
    const today = todayAmsterdam();
    await env.DB
      .prepare(
        `INSERT INTO tasks (id, family_id, title, points, assignees, recurrence)
         VALUES ('tsk_wkg', ?, 'Tanden poetsen', 5, ?, ?)`,
      )
      .bind(fam.familyId, JSON.stringify([fam.childA]), JSON.stringify({ freq: "daily" }))
      .run();

    const remaining = weekDates(today).filter((d) => d >= today).length;
    const created = await generateWeekAheadForFamily(env.DB, fam.familyId, { vacation_mode: 0 }, today);
    expect(created).toBe(remaining);

    const { results } = await env.DB
      .prepare("SELECT DISTINCT date FROM task_instances WHERE family_id = ? AND child_id = ?")
      .bind(fam.familyId, fam.childA)
      .all();
    expect(results.length).toBe(remaining);
  });

  it("weekbonus valt zodra 80% van de week af is — ook op een niet-zondag", async () => {
    const fam = await seedFamily("wkb");
    const taskId = await seedTask(fam.familyId, fam.childA, { points: 10 });
    const ids: string[] = [];
    for (const d of weekDates(todayAmsterdam()).slice(0, 5)) {
      ids.push(await seedInstance(fam.familyId, taskId, fam.childA, d));
    }
    const token = await childToken(fam.childA, fam.familyId);

    let last: { weekBonusEarned: boolean } | undefined;
    for (let i = 0; i < 4; i++) {
      // 4 van 5 = 80% → drempel gehaald
      const res = await api(`/instances/${ids[i]}/complete`, {
        method: "POST",
        token,
        idempotencyKey: crypto.randomUUID(),
      });
      last = (await res.json()) as { weekBonusEarned: boolean };
    }
    expect(last?.weekBonusEarned).toBe(true);
  });
});
