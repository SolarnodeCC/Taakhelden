/**
 * Regressietests voor de vier HIGH-bevindingen uit de security-audit van
 * 2026-08 (docs/security/wispel-security-audit-2026-08.md).
 *
 *   1. Rate limiting valt niet terug op één gedeelde teller.
 *   2. Turnstile faalt dicht zonder secret.
 *   3. Access-tokens zijn intrekbaar (kind verwijderen / sessies intrekken).
 *   4. PIN-lockout telt atomair, ook bij gelijktijdige pogingen.
 *
 * Elk van deze tests faalt op de code van vóór de fix.
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { hashSecret } from "../src/services/passwords";
import { seedFamily, parentToken, childToken, api } from "./helpers";

// ─── 1. Rate limiting: geen gedeelde bucket ──────────────────────────────────

describe("rate limiting keyt op de aanroeper", () => {
  it("laat twee IP's elkaars budget niet opeten", async () => {
    const window = Math.floor(Date.now() / 60_000);
    const busyIp = "198.51.100.10";
    // Zet het budget van één IP vol.
    await env.KV.put(`rl:login:${busyIp}:${window}`, "5", { expirationTtl: 120 });

    const blocked = await api("/auth/login", {
      body: { email: "someone@test.local", password: "irrelevant" },
      headers: { "CF-Connecting-IP": busyIp },
    });
    expect(blocked.status).toBe(429);

    // Een ander IP moet gewoon door kunnen (401 = credentials fout, niet 429).
    const other = await api("/auth/login", {
      body: { email: "someone@test.local", password: "irrelevant" },
      headers: { "CF-Connecting-IP": "198.51.100.11" },
    });
    expect(other.status).toBe(401);
  });

  it("accepteert het IP dat de BFF doorgeeft in X-Forwarded-For", async () => {
    const window = Math.floor(Date.now() / 60_000);
    const ip = "198.51.100.20";
    await env.KV.put(`rl:login:${ip}:${window}`, "5", { expirationTtl: 120 });

    const res = await api("/auth/login", {
      body: { email: "someone@test.local", password: "irrelevant" },
      headers: { "X-Forwarded-For": `${ip}, 10.0.0.1` },
    });
    expect(res.status).toBe(429);
  });

  it("begrenst inloggen per account, ook als het IP wisselt", async () => {
    const email = "target@test.local";
    for (let i = 0; i < 10; i++) {
      const res = await api("/auth/login", {
        body: { email, password: "wrong-password" },
        // Elke poging een ander IP: alleen de account-teller kan dit stoppen.
        headers: { "CF-Connecting-IP": `192.0.2.${i + 1}` },
      });
      expect(res.status).toBe(401);
    }
    const blocked = await api("/auth/login", {
      body: { email, password: "wrong-password" },
      headers: { "CF-Connecting-IP": "192.0.2.99" },
    });
    expect(blocked.status).toBe(429);
  });
});

// ─── 2. Turnstile faalt dicht ────────────────────────────────────────────────

describe("Turnstile faalt dicht", () => {
  it("weigert registratie als het secret ontbreekt en de dev-bypass uit staat", async () => {
    const bypass = env.TURNSTILE_DEV_BYPASS;
    env.TURNSTILE_DEV_BYPASS = "";
    try {
      const res = await api("/auth/register", {
        body: {
          email: `failclosed-${crypto.randomUUID()}@test.local`,
          password: "TestPassword_NotASecret_123",
          familyName: "Testgezin",
          displayName: "Ouder",
          turnstileToken: "dev-bypass",
        },
        headers: { "CF-Connecting-IP": "198.51.100.30" },
      });
      // Configuratiefout → 500, nooit een aangemaakt account.
      expect(res.status).toBe(500);
    } finally {
      env.TURNSTILE_DEV_BYPASS = bypass;
    }
  });
});

// ─── 3. Access-tokens zijn intrekbaar ────────────────────────────────────────

describe("intrekken van uitgegeven access-tokens", () => {
  it("maakt het kind-token ongeldig zodra de ouder de sessies intrekt", async () => {
    const fam = await seedFamily("revoke");
    const tok = await childToken(fam.childA, fam.familyId);
    const parent = await parentToken(fam.parentId, fam.familyId);

    // Vóór intrekking werkt het token.
    expect((await api("/members", { token: tok })).status).toBe(200);

    const revoked = await api(`/members/${fam.childA}/device-sessions/revoke`, {
      method: "POST",
      token: parent,
    });
    expect(revoked.status).toBe(200);

    // Ná intrekking niet meer — eerder bleef dit tot 24 u geldig terwijl de
    // ouder "ingetrokken" te zien kreeg.
    const after = await api("/members", { token: tok });
    expect(after.status).toBe(401);
  });

  it("maakt het kind-token ongeldig zodra het kind verwijderd wordt", async () => {
    const fam = await seedFamily("revdel");
    const tok = await childToken(fam.childA, fam.familyId);
    const parent = await parentToken(fam.parentId, fam.familyId);

    expect((await api("/members", { token: tok })).status).toBe(200);
    expect((await api(`/members/${fam.childA}`, { method: "DELETE", token: parent })).status).toBe(200);
    expect((await api("/members", { token: tok })).status).toBe(401);
  });

  it("raakt andere gezinsleden niet", async () => {
    const fam = await seedFamily("revscope");
    const other = await childToken(fam.childB, fam.familyId);
    const parent = await parentToken(fam.parentId, fam.familyId);

    await api(`/members/${fam.childA}/device-sessions/revoke`, { method: "POST", token: parent });
    expect((await api("/members", { token: other })).status).toBe(200);
  });
});

// ─── 4. PIN-lockout telt atomair ─────────────────────────────────────────────

describe("PIN-lockout", () => {
  async function seedChildWithPin(prefix: string, pincode: string) {
    const fam = await seedFamily(prefix);
    await env.DB
      .prepare("UPDATE users SET pincode_hash = ? WHERE id = ?")
      .bind(await hashSecret(pincode), fam.childA)
      .run();
    const family = await env.DB
      .prepare("SELECT invite_code FROM families WHERE id = ?")
      .bind(fam.familyId)
      .first<{ invite_code: string }>();
    return { ...fam, familyCode: family!.invite_code };
  }

  it("vergrendelt na 5 mislukte pogingen", async () => {
    const fam = await seedChildWithPin("pinl", "1234");
    const attempt = (pincode: string) =>
      api("/auth/child-session", {
        body: { familyCode: fam.familyCode, childId: fam.childA, pincode },
        headers: { "CF-Connecting-IP": "198.51.100.40" },
      });

    for (let i = 0; i < 4; i++) {
      expect((await attempt("0000")).status).toBe(401);
    }
    expect((await attempt("0000")).status).toBe(403);

    // Ook de juiste pincode komt er nu niet meer door.
    expect((await attempt("1234")).status).toBe(403);

    const row = await env.DB
      .prepare("SELECT pin_fail_count, pin_locked_until FROM users WHERE id = ?")
      .bind(fam.childA)
      .first<{ pin_fail_count: number; pin_locked_until: string | null }>();
    expect(row?.pin_fail_count).toBeGreaterThanOrEqual(5);
    expect(row?.pin_locked_until).toBeTruthy();
  });

  it("vergrendelt ook als de pogingen gelijktijdig binnenkomen", async () => {
    const fam = await seedChildWithPin("pinr", "1234");
    // Parallel: met de oude KV-teller (read-then-write) lazen deze allemaal
    // dezelfde stand en bleef de lock uit.
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        api("/auth/child-session", {
          body: { familyCode: fam.familyCode, childId: fam.childA, pincode: "9999" },
          headers: { "CF-Connecting-IP": `198.51.100.5${i}` },
        }),
      ),
    );

    const row = await env.DB
      .prepare("SELECT pin_fail_count, pin_locked_until FROM users WHERE id = ?")
      .bind(fam.childA)
      .first<{ pin_fail_count: number; pin_locked_until: string | null }>();
    expect(row?.pin_fail_count).toBe(8);
    expect(row?.pin_locked_until).toBeTruthy();
  });

  it("wist teller en lock na een geslaagde login", async () => {
    const fam = await seedChildWithPin("pins", "4321");
    const attempt = (pincode: string) =>
      api("/auth/child-session", {
        body: { familyCode: fam.familyCode, childId: fam.childA, pincode },
        headers: { "CF-Connecting-IP": "198.51.100.60" },
      });

    expect((await attempt("0000")).status).toBe(401);
    expect((await attempt("4321")).status).toBe(200);

    const row = await env.DB
      .prepare("SELECT pin_fail_count, pin_locked_until FROM users WHERE id = ?")
      .bind(fam.childA)
      .first<{ pin_fail_count: number; pin_locked_until: string | null }>();
    expect(row?.pin_fail_count).toBe(0);
    expect(row?.pin_locked_until).toBeNull();
  });
});
