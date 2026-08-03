/**
 * WS-TRUST-API — beveiligingsregressietests (Horizon B.5):
 *   1. Rate-limit op POST /auth/refresh + POST /auth/child-session/refresh (30/min/IP).
 *   2. Rate-limit (3/uur) + idempotency op POST /account/export.
 *   3. GET /instances/pending-approval: authz (kind → 403, cross-family → lege lijst).
 *
 * Patroon voor rate-limit tests: KV-teller direct op de limiet zetten,
 * daarna één verzoek → 429 RATE_LIMITED. Voorkomt N echte roundtrips.
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { seedFamily, seedTask, seedInstance, parentToken, childToken, api, todayAmsterdam } from "./helpers";

/**
 * Vast client-IP voor deze suite. De limiter kent geen gedeelde fallback meer:
 * zonder identificeerbaar IP krijgt elk request een eigen sleutel (zie
 * middleware/ratelimit.ts), dus een rate-limit test moet zelf een IP meesturen.
 */
const TEST_IP = "203.0.113.7";
const ipHeaders = { "CF-Connecting-IP": TEST_IP };

// Bereken de huidige KV-windowsleutel, net zoals rateLimit() dat doet.
function rlKey(bucket: string, windowSeconds: number) {
  const window = Math.floor(Date.now() / (windowSeconds * 1000));
  return `rl:${bucket}:${TEST_IP}:${window}`;
}

// ─── 1. Auth refresh rate limits ─────────────────────────────────────────────

describe("POST /auth/refresh rate limit", () => {
  it("retourneert 429 als de limiet (30/min) overschreden is", async () => {
    await env.KV.put(rlKey("refresh", 60), "30", { expirationTtl: 120 });
    const res = await api("/auth/refresh", {
      body: { refreshToken: "does-not-matter" },
      headers: ipHeaders,
    });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});

describe("POST /auth/child-session/refresh rate limit", () => {
  it("retourneert 429 als de limiet (30/min) overschreden is", async () => {
    await env.KV.put(rlKey("child-refresh", 60), "30", { expirationTtl: 120 });
    const res = await api("/auth/child-session/refresh", {
      body: { refreshToken: "does-not-matter" },
      headers: ipHeaders,
    });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});

// ─── 2. Export rate limit + idempotency ──────────────────────────────────────

describe("POST /account/export rate limit + idempotency", () => {
  it("vereist Idempotency-Key header (400 zonder)", async () => {
    const fam = await seedFamily("expidem");
    const tok = await parentToken(fam.parentId, fam.familyId);
    const res = await api("/account/export", { method: "POST", token: tok });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("retourneert 429 als de limiet (3/uur) overschreden is", async () => {
    const fam = await seedFamily("exprl");
    const tok = await parentToken(fam.parentId, fam.familyId);
    await env.KV.put(rlKey("export", 3600), "3", { expirationTtl: 7200 });
    const res = await api("/account/export", {
      method: "POST",
      token: tok,
      idempotencyKey: crypto.randomUUID(),
      headers: ipHeaders,
    });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("zelfde Idempotency-Key retourneert dezelfde exportId (geen tweede job)", async () => {
    // Zet eventuele rate-limit teller terug (van de 429-test in dezelfde suite).
    await env.KV.delete(rlKey("export", 3600));

    const fam = await seedFamily("expidem2");
    const tok = await parentToken(fam.parentId, fam.familyId);
    const idemKey = crypto.randomUUID();

    const first = await api("/account/export", {
      method: "POST",
      token: tok,
      idempotencyKey: idemKey,
    });
    expect(first.status).toBe(202);
    const { exportId: id1 } = (await first.json()) as { exportId: string };

    const second = await api("/account/export", {
      method: "POST",
      token: tok,
      idempotencyKey: idemKey,
    });
    expect(second.status).toBe(200); // replay → 200 met Idempotent-Replay header
    const { exportId: id2 } = (await second.json()) as { exportId: string };
    expect(id2).toBe(id1);

    // Slechts één rij in D1 aangemaakt.
    const count = await env.DB
      .prepare("SELECT COUNT(*) AS c FROM account_exports WHERE family_id = ?")
      .bind(fam.familyId)
      .first<{ c: number }>();
    expect(count?.c).toBe(1);
  });

  it("short-circuits als er al een pending export bestaat voor het gezin", async () => {
    // Zet eventuele rate-limit teller terug (van de 429-test in dezelfde suite).
    await env.KV.delete(rlKey("export", 3600));

    const fam = await seedFamily("expshort");
    const tok = await parentToken(fam.parentId, fam.familyId);

    const first = await api("/account/export", {
      method: "POST",
      token: tok,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(first.status).toBe(202);
    const { exportId: id1 } = (await first.json()) as { exportId: string };

    // Tweede aanroep met ANDERE key → bestaande pending job terugkrijgen.
    const second = await api("/account/export", {
      method: "POST",
      token: tok,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(second.status).toBe(202);
    const { exportId: id2 } = (await second.json()) as { exportId: string };
    expect(id2).toBe(id1);

    // Nog steeds maar één rij.
    const count = await env.DB
      .prepare("SELECT COUNT(*) AS c FROM account_exports WHERE family_id = ?")
      .bind(fam.familyId)
      .first<{ c: number }>();
    expect(count?.c).toBe(1);
  });
});

// ─── 3. GET /instances/pending-approval ──────────────────────────────────────

describe("GET /instances/pending-approval", () => {
  it("retourneert submitted instances van alle datums, oudste eerst", async () => {
    const fam = await seedFamily("pend");
    const today = todayAmsterdam();
    // Maak twee taken en instances, één van gisteren (submitted), één van vandaag (open).
    const taskId = await seedTask(fam.familyId, fam.childA, { points: 10, approvalRequired: true });
    const yesterday = new Date(new Date(today).getTime() - 86400000)
      .toISOString()
      .slice(0, 10);

    const instYesterday = await seedInstance(fam.familyId, taskId, fam.childA, yesterday);
    const instToday = await seedInstance(fam.familyId, taskId, fam.childA, today);

    // Zet gisteren op submitted (wacht op goedkeuring).
    await env.DB
      .prepare("UPDATE task_instances SET status = 'submitted', completed_at = datetime('now') WHERE id = ?")
      .bind(instYesterday)
      .run();

    const tok = await parentToken(fam.parentId, fam.familyId);
    const res = await api("/instances/pending-approval", { token: tok });
    expect(res.status).toBe(200);
    const { items } = (await res.json()) as { items: Array<{ id: string; status: string; childName: string }> };

    // Alleen de submitted instance zit in de rij; open instances niet.
    expect(items.some((i) => i.id === instYesterday)).toBe(true);
    expect(items.some((i) => i.id === instToday)).toBe(false);
    // childName staat erbij.
    const item = items.find((i) => i.id === instYesterday);
    expect(item?.childName).toBe("Noor");
    expect(item?.status).toBe("submitted");
  });

  it("kind krijgt 403", async () => {
    const fam = await seedFamily("pendchild");
    const res = await api("/instances/pending-approval", {
      token: await childToken(fam.childA, fam.familyId),
    });
    expect(res.status).toBe(403);
  });

  it("ouder van gezin A ziet GEEN instances van gezin B", async () => {
    const famA = await seedFamily("penda");
    const famB = await seedFamily("pendb");
    const taskB = await seedTask(famB.familyId, famB.childA, { approvalRequired: true });
    const instB = await seedInstance(famB.familyId, taskB, famB.childA, todayAmsterdam());
    await env.DB
      .prepare("UPDATE task_instances SET status = 'submitted' WHERE id = ?")
      .bind(instB)
      .run();

    const res = await api("/instances/pending-approval", {
      token: await parentToken(famA.parentId, famA.familyId),
    });
    expect(res.status).toBe(200);
    const { items } = (await res.json()) as { items: Array<{ id: string }> };
    expect(items.some((i) => i.id === instB)).toBe(false);
  });

  it("approve_only-ouder mag ook de wachtrij zien (geen full rechten vereist)", async () => {
    const fam = await seedFamily("pendappronly");
    const res = await api("/instances/pending-approval", {
      token: await parentToken(fam.parentId, fam.familyId, { perm: "approve_only" }),
    });
    expect(res.status).toBe(200);
  });
});
