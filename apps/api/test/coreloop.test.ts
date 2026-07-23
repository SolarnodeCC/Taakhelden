/**
 * De kern van de app end-to-end: registreren → kind + taak aanmaken →
 * afvinken → punten in het ledger → idempotente replay.
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { seedFamily, seedTask, seedInstance, seedWeekFiller, parentToken, childToken, api, todayAmsterdam } from "./helpers";

describe("auth-flow", () => {
  it("registreren → inloggen → gezinscode → kind-sessie", async () => {
    const register = await api("/auth/register", {
      body: {
        email: "ouder@test.local",
        password: "superveilig123",
        familyName: "De Testjes",
        displayName: "Merel",
        turnstileToken: "test",
      },
    });
    expect(register.status).toBe(201);
    const reg = (await register.json()) as { accessToken: string; refreshToken: string; familyId: string };
    expect(reg.accessToken).toBeTruthy();

    // Kindprofiel aanmaken met de ouder-token
    const child = await api("/members/children", {
      token: reg.accessToken,
      body: { displayName: "Noor", birthYear: 2017, pincode: "1234" },
    });
    expect(child.status).toBe(201);
    const childBody = (await child.json()) as { id: string; ageMode: string };
    expect(childBody.ageMode).toBe("mid"); // 2026 - 2017 = 9 jaar

    // Gezinscode ophalen en de kind-loginflow doorlopen
    const me = await api("/families/me", { token: reg.accessToken });
    const { inviteCode } = (await me.json()) as { inviteCode: string };
    expect(inviteCode).toHaveLength(6);

    const profiles = await api("/auth/family-code", { body: { familyCode: inviteCode } });
    expect(profiles.status).toBe(200);
    const list = (await profiles.json()) as { children: Array<{ id: string; displayName: string }> };
    expect(list.children.map((c) => c.displayName)).toContain("Noor");

    const session = await api("/auth/child-session", {
      body: { familyCode: inviteCode, childId: childBody.id, pincode: "1234" },
    });
    expect(session.status).toBe(200);

    // Foute pincode is vriendelijk maar duidelijk fout
    const wrong = await api("/auth/child-session", {
      body: { familyCode: inviteCode, childId: childBody.id, pincode: "9999" },
    });
    expect(wrong.status).toBe(401);

    // Refresh-rotatie: nieuwe pair, oude refresh vervalt
    const refresh1 = await api("/auth/refresh", { body: { refreshToken: reg.refreshToken } });
    expect(refresh1.status).toBe(200);
    const refresh2 = await api("/auth/refresh", { body: { refreshToken: reg.refreshToken } });
    expect(refresh2.status).toBe(401);
  });

  it("gelijktijdige refresh met dezelfde token: precies één wint (geen dubbele rotatie)", async () => {
    const register = await api("/auth/register", {
      body: {
        email: "race@test.local",
        password: "superveilig123",
        familyName: "De Racers",
        displayName: "Tess",
        turnstileToken: "test",
      },
    });
    const reg = (await register.json()) as { refreshToken: string };

    // Twee parallelle refreshes met dezelfde single-use token. De atomische
    // consume mag er hooguit één laten slagen — nooit beide (dubbel-issue).
    const [a, b] = await Promise.all([
      api("/auth/refresh", { body: { refreshToken: reg.refreshToken } }),
      api("/auth/refresh", { body: { refreshToken: reg.refreshToken } }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 401]);
  });
});

describe("kernlus: afvinken → punten → idempotent", () => {
  it("complete boekt punten + dagbonus in het ledger, replay geeft geen dubbele punten", async () => {
    const fam = await seedFamily("loop");
    const taskId = await seedTask(fam.familyId, fam.childA, { points: 15 });
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());
    // Nog open taken elders in de week: weektotaal realistisch, dus deze ene
    // complete triggert (terecht) nog geen weekbonus.
    await seedWeekFiller(fam.familyId, taskId, fam.childA, todayAmsterdam(), 4);
    const token = await childToken(fam.childA, fam.familyId);
    const key = crypto.randomUUID();

    const complete = await api(`/instances/${instanceId}/complete`, {
      method: "POST",
      token,
      idempotencyKey: key,
    });
    expect(complete.status).toBe(200);
    const result = (await complete.json()) as {
      pointsEarned: number;
      dayBonusEarned: boolean;
      newBalance: number;
    };
    expect(result.pointsEarned).toBe(15);
    expect(result.dayBonusEarned).toBe(true); // enige taak van de dag → dagbonus (20)
    expect(result.newBalance).toBe(35);

    // Replay met dezelfde Idempotency-Key: zelfde response, geen dubbele punten
    const replay = await api(`/instances/${instanceId}/complete`, {
      method: "POST",
      token,
      idempotencyKey: key,
    });
    expect(replay.status).toBe(200);
    expect(replay.headers.get("Idempotent-Replay")).toBe("true");
    expect(((await replay.json()) as { newBalance: number }).newBalance).toBe(35);

    // Nieuwe key op een al-afgevinkte taak → 409, saldo blijft 35
    const dubbel = await api(`/instances/${instanceId}/complete`, {
      method: "POST",
      token,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(dubbel.status).toBe(409);

    const som = await env.DB
      .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM points_ledger WHERE family_id = ? AND child_id = ?")
      .bind(fam.familyId, fam.childA)
      .first<{ s: number }>();
    expect(som?.s).toBe(35);

    // Zonder Idempotency-Key is afvinken niet toegestaan (spec §3.5)
    const zonderKey = await api(`/instances/${instanceId}/complete`, { method: "POST", token });
    expect(zonderKey.status).toBe(400);
  });

  it("approvalRequired: submitted → approve door ouder boekt de punten", async () => {
    const fam = await seedFamily("appr");
    const taskId = await seedTask(fam.familyId, fam.childA, { points: 10, approvalRequired: true });
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());
    await seedWeekFiller(fam.familyId, taskId, fam.childA, todayAmsterdam(), 4);

    const complete = await api(`/instances/${instanceId}/complete`, {
      method: "POST",
      token: await childToken(fam.childA, fam.familyId),
      idempotencyKey: crypto.randomUUID(),
    });
    expect(complete.status).toBe(200);
    expect(((await complete.json()) as { pointsEarned: number }).pointsEarned).toBe(0); // wacht op ouder

    const approve = await api(`/instances/${instanceId}/approve`, {
      method: "POST",
      token: await parentToken(fam.parentId, fam.familyId, { perm: "approve_only" }),
    });
    expect(approve.status).toBe(200);
    const approved = (await approve.json()) as { pointsEarned: number; newBalance: number };
    expect(approved.pointsEarned).toBe(10);
    expect(approved.newBalance).toBe(30); // 10 + dagbonus 20
  });

  it("redo geeft GEEN puntenaftrek en zet status op open_redo", async () => {
    const fam = await seedFamily("redo");
    const taskId = await seedTask(fam.familyId, fam.childA, { points: 10, approvalRequired: true });
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());
    const childTok = await childToken(fam.childA, fam.familyId);

    await api(`/instances/${instanceId}/complete`, {
      method: "POST",
      token: childTok,
      idempotencyKey: crypto.randomUUID(),
    });
    const redo = await api(`/instances/${instanceId}/redo`, {
      method: "POST",
      token: await parentToken(fam.parentId, fam.familyId),
      body: { note: "Kijk nog even onder je bed 😉" },
    });
    expect(redo.status).toBe(200);

    const row = await env.DB
      .prepare("SELECT status, redo_note FROM task_instances WHERE family_id = ? AND id = ?")
      .bind(fam.familyId, instanceId)
      .first<{ status: string; redo_note: string }>();
    expect(row?.status).toBe("open_redo");
    expect(row?.redo_note).toContain("bed");

    const som = await env.DB
      .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM points_ledger WHERE family_id = ? AND child_id = ?")
      .bind(fam.familyId, fam.childA)
      .first<{ s: number }>();
    expect(som?.s).toBe(0); // geen aftrek, ook niets geboekt
  });
});
