/**
 * Account/AVG (API-spec §3.12): export (art. 20), soft delete met
 * wachtwoordbevestiging, en de purge-cascade over D1 + R2 + KV (art. 17).
 */
import { describe, it, expect } from "vitest";
import { env, SELF } from "cloudflare:test";
import { unzipSync, strFromU8 } from "fflate";
import { seedFamily, seedTask, seedInstance, parentToken, childToken, api, todayAmsterdam } from "./helpers";
import { purgeExpiredAccounts, purgeFamily } from "../src/services/accountPurge";
import { processExports } from "../src/jobs/exportConsumer";

/** Handmatige queue-batch voor de export-consumer (deterministisch). */
function fakeExportBatch(exportId: string, familyId: string): MessageBatch {
  return {
    queue: "export-processing",
    messages: [{ body: { exportId, familyId }, ack() {}, retry() {} }],
  } as unknown as MessageBatch;
}

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

describe("account-export (async ZIP, AVG art. 20)", () => {
  it("ouder start een export; de queue bouwt een ZIP met JSON + foto; downloadlink werkt", async () => {
    const fam = await seedFamily("exp");
    const taskId = await seedTask(fam.familyId, fam.childA, { points: 15 });
    await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());
    const parentTok = await parentToken(fam.parentId, fam.familyId);

    // Een 'ready' foto: rij in D1 + bytes in R2, zodat de export ze meepakt.
    const photoId = "ph_exp1";
    const r2key = `task/${fam.familyId}/${photoId}`;
    await env.PHOTOS.put(r2key, "fake-jpeg-bytes");
    await env.DB
      .prepare(
        `INSERT INTO photos (id, family_id, owner_id, purpose, r2_key, content_type, bytes, status)
         VALUES (?, ?, ?, 'task', ?, 'image/jpeg', 15, 'ready')`,
      )
      .bind(photoId, fam.familyId, fam.childA, r2key)
      .run();

    // Start → 202 pending
    const start = await api("/account/export", { method: "POST", token: parentTok });
    expect(start.status).toBe(202);
    const { exportId, status } = (await start.json()) as { exportId: string; status: string };
    expect(status).toBe("pending");

    // Vóór verwerking: nog pending, geen downloadlink
    const pending = (await (await api(`/account/export/${exportId}`, { token: parentTok })).json()) as {
      status: string;
      downloadUrl?: string;
    };
    expect(pending.status).toBe("pending");
    expect(pending.downloadUrl).toBeUndefined();

    // Queue verwerkt de job
    await processExports(fakeExportBatch(exportId, fam.familyId), env);

    // Klaar + kortlevende downloadlink
    const ready = (await (await api(`/account/export/${exportId}`, { token: parentTok })).json()) as {
      status: string;
      downloadUrl: string;
    };
    expect(ready.status).toBe("ready");
    expect(ready.downloadUrl).toContain(`/v1/account/export/${exportId}/file`);

    // Download is publiek maar HMAC-gesigneerd
    const dl = await SELF.fetch(ready.downloadUrl);
    expect(dl.status).toBe(200);
    expect(dl.headers.get("Content-Disposition")).toContain("attachment");

    const entries = unzipSync(new Uint8Array(await dl.arrayBuffer()));
    expect(Object.keys(entries)).toContain("export.json");
    expect(Object.keys(entries).some((k) => k.startsWith("photos/"))).toBe(true);
    const manifest = JSON.parse(strFromU8(entries["export.json"]!)) as {
      family: { id: string };
      tasks: Array<{ id: string }>;
    };
    expect(manifest.family.id).toBe(fam.familyId);
    expect(manifest.tasks.some((t) => t.id === taskId)).toBe(true);
  });

  it("kind mag geen export starten (403)", async () => {
    const fam = await seedFamily("expx");
    const res = await api("/account/export", {
      method: "POST",
      token: await childToken(fam.childA, fam.familyId),
    });
    expect(res.status).toBe(403);
  });

  it("download met een geknoeide handtekening → 403", async () => {
    const fam = await seedFamily("expsig");
    const parentTok = await parentToken(fam.parentId, fam.familyId);
    const { exportId } = (await (await api("/account/export", { method: "POST", token: parentTok })).json()) as {
      exportId: string;
    };
    await processExports(fakeExportBatch(exportId, fam.familyId), env);
    const forged = `https://api.test/v1/account/export/${exportId}/file?fam=${fam.familyId}&exp=9999999999&sig=deadbeef`;
    const res = await SELF.fetch(forged);
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
