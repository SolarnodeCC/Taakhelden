/**
 * Account/AVG (API-spec §3.12): export (art. 20), soft delete met
 * wachtwoordbevestiging, en de purge-cascade over D1 + R2 + KV (art. 17).
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { seedFamily, seedTask, seedInstance, parentToken, childToken, api, todayAmsterdam } from "./helpers";
import { purgeExpiredAccounts, purgeFamily } from "../src/services/accountPurge";

let regCounter = 0;
async function registerFamily(password = "superveilig123") {
  regCounter++;
  const res = await api("/auth/register", {
    body: {
      email: `avg${regCounter}@test.local`,
      password,
      familyName: "AVG-gezin",
      displayName: "Ouder",
      turnstileToken: "test",
    },
  });
  return res.json() as Promise<{ accessToken: string; familyId: string; userId: string }>;
}

describe("GET /account/export", () => {
  it("ouder krijgt een machineleesbare export van gezinsdata", async () => {
    const fam = await seedFamily("exp");
    const taskId = await seedTask(fam.familyId, fam.childA, { points: 15 });
    await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());

    const res = await api("/account/export", { token: await parentToken(fam.parentId, fam.familyId) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("attachment");

    const body = (await res.json()) as {
      family: { id: string };
      members: unknown[];
      tasks: Array<{ id: string }>;
    };
    expect(body.family.id).toBe(fam.familyId);
    expect(body.members.length).toBe(3); // 1 ouder + 2 kinderen
    expect(body.tasks.some((t) => t.id === taskId)).toBe(true);
  });

  it("kind mag geen export opvragen (403)", async () => {
    const fam = await seedFamily("expx");
    const res = await api("/account/export", { token: await childToken(fam.childA, fam.familyId) });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /account", () => {
  it("juist wachtwoord → soft delete; gezin daarna onzichtbaar", async () => {
    const reg = await registerFamily();
    const del = await api("/account", {
      method: "DELETE",
      token: reg.accessToken,
      body: { password: "superveilig123" },
    });
    expect(del.status).toBe(200);
    const body = (await del.json()) as { deletedAt: string; purgeAfter: string };
    expect(new Date(body.purgeAfter) > new Date(body.deletedAt)).toBe(true);

    // Gezin is soft-deleted → /families/me geeft 404
    const me = await api("/families/me", { token: reg.accessToken });
    expect(me.status).toBe(404);

    const row = await env.DB
      .prepare("SELECT deleted_at FROM families WHERE id = ?")
      .bind(reg.familyId)
      .first<{ deleted_at: string | null }>();
    expect(row?.deleted_at).toBeTruthy();
  });

  it("fout wachtwoord → 401, gezin blijft bestaan", async () => {
    const reg = await registerFamily();
    const del = await api("/account", {
      method: "DELETE",
      token: reg.accessToken,
      body: { password: "helemaalfout" },
    });
    expect(del.status).toBe(401);

    const row = await env.DB
      .prepare("SELECT deleted_at FROM families WHERE id = ?")
      .bind(reg.familyId)
      .first<{ deleted_at: string | null }>();
    expect(row?.deleted_at).toBeNull();
  });

  it("approve_only-ouder mag het gezin niet verwijderen (403)", async () => {
    const fam = await seedFamily("delp");
    const res = await api("/account", {
      method: "DELETE",
      token: await parentToken(fam.parentId, fam.familyId, { perm: "approve_only" }),
      body: { password: "x" },
    });
    expect(res.status).toBe(403);
  });

  it("kind mag het gezin niet verwijderen (403)", async () => {
    const fam = await seedFamily("delc");
    const res = await api("/account", {
      method: "DELETE",
      token: await childToken(fam.childA, fam.familyId),
      body: { password: "x" },
    });
    expect(res.status).toBe(403);
  });
});

describe("purge-cascade", () => {
  it("verwijdert D1-rijen, R2-objecten en KV-sleutels van één gezin", async () => {
    const fam = await seedFamily("prg");
    const taskId = await seedTask(fam.familyId, fam.childA, { points: 15 });
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());
    // Wat data in het ledger zetten via de echte flow.
    await api(`/instances/${instanceId}/complete`, {
      method: "POST",
      token: await childToken(fam.childA, fam.familyId),
      idempotencyKey: crypto.randomUUID(),
    });

    // Sporen buiten D1: een foto in R2 onder de gezins-prefix en een KV-sleutel.
    await env.PHOTOS.put(`task/${fam.familyId}/ph_test.jpg`, "x");
    await env.KV.put(`pinfail:${fam.childA}`, "3");

    await purgeFamily(env, fam.familyId);

    const family = await env.DB.prepare("SELECT id FROM families WHERE id = ?").bind(fam.familyId).first();
    const users = await env.DB
      .prepare("SELECT COUNT(*) AS c FROM users WHERE family_id = ?")
      .bind(fam.familyId)
      .first<{ c: number }>();
    const ledger = await env.DB
      .prepare("SELECT COUNT(*) AS c FROM points_ledger WHERE family_id = ?")
      .bind(fam.familyId)
      .first<{ c: number }>();
    expect(family).toBeNull();
    expect(users?.c).toBe(0);
    expect(ledger?.c).toBe(0);

    expect(await env.PHOTOS.get(`task/${fam.familyId}/ph_test.jpg`)).toBeNull();
    expect(await env.KV.get(`pinfail:${fam.childA}`)).toBeNull();
  });

  it("purgeExpiredAccounts pakt alleen gezinnen voorbij het 7-daagse venster", async () => {
    const oud = await seedFamily("prgold");
    const vers = await seedFamily("prgnew");
    const lang = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
    const kort = new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString();
    await env.DB.prepare("UPDATE families SET deleted_at = ? WHERE id = ?").bind(lang, oud.familyId).run();
    await env.DB.prepare("UPDATE families SET deleted_at = ? WHERE id = ?").bind(kort, vers.familyId).run();

    const purged = await purgeExpiredAccounts(env);
    expect(purged).toBeGreaterThanOrEqual(1);

    expect(await env.DB.prepare("SELECT id FROM families WHERE id = ?").bind(oud.familyId).first()).toBeNull();
    // Nog binnen het venster → blijft (soft-deleted) bestaan
    expect(await env.DB.prepare("SELECT id FROM families WHERE id = ?").bind(vers.familyId).first()).not.toBeNull();
  });
});
