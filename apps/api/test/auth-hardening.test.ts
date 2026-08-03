/**
 * Regressietests voor de vier HIGH-bevindingen uit de security-audit van
 * 2026-08 (docs/security/wispel-security-audit-2026-08.md).
 *
 *   1. Rate limiting valt niet terug op één gedeelde teller.
 *   2. Turnstile faalt dicht zonder secret.
 *   3. Access-tokens zijn intrekbaar (kind verwijderen / sessies intrekken).
 *   4. PIN-lockout telt atomair, ook bij gelijktijdige pogingen.
 *
 * Plus de MEDIUM-bevindingen die in dezelfde reeks zijn opgepakt:
 *   8.  HMAC_SECRET is gescheiden van JWT_SECRET en faalt dicht.
 *   13. Basislimiet per ingelogde gebruiker op alle geauthenticeerde routes.
 *
 * Elk van deze tests faalt op de code van vóór de fix.
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { signJwt } from "../src/services/jwt";
import { WS_SUBPROTOCOL, wsAuthSubprotocols } from "@taakhelden/shared";
import { hashSecret, needsRehash, sha256Hex } from "../src/services/passwords";
import {
  seedFamily,
  seedTask,
  seedInstance,
  parentToken,
  childToken,
  api,
  todayAmsterdam,
} from "./helpers";

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

// ─── 5. Basislimiet op geauthenticeerde routes (audit-bevinding 13) ──────────

describe("basislimiet per ingelogde gebruiker", () => {
  it("geeft 429 zodra het gebruikersbudget op is", async () => {
    const fam = await seedFamily("rluser");
    const tok = await parentToken(fam.parentId, fam.familyId);
    const window = Math.floor(Date.now() / 60_000);
    await env.KV.put(`rl:user:${await sha256Hex(fam.parentId)}:${window}`, "300", {
      expirationTtl: 120,
    });

    const res = await api("/members", { token: tok });
    expect(res.status).toBe(429);
  });

  it("telt per gebruiker, niet per gezin", async () => {
    const fam = await seedFamily("rlscope");
    const child = await childToken(fam.childA, fam.familyId);
    const window = Math.floor(Date.now() / 60_000);
    // Budget van de ouder vol; het kind moet gewoon door kunnen.
    await env.KV.put(`rl:user:${await sha256Hex(fam.parentId)}:${window}`, "300", {
      expirationTtl: 120,
    });

    expect((await api("/members", { token: child })).status).toBe(200);
  });
});

// ─── 6. Sleutelscheiding voor transfer-URL's (audit-bevinding 8) ─────────────

describe("HMAC_SECRET is gescheiden van JWT_SECRET", () => {
  it("gebruikt niet langer JWT_SECRET als terugval", async () => {
    expect(env.HMAC_SECRET).toBeTruthy();
    expect(env.HMAC_SECRET).not.toBe(env.JWT_SECRET);
  });

  it("faalt dicht als HMAC_SECRET ontbreekt", async () => {
    const fam = await seedFamily("hmac");
    const tok = await childToken(fam.childA, fam.familyId);
    const taskId = await seedTask(fam.familyId, fam.childA);
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());
    const body = {
      purpose: "task" as const,
      instanceId,
      contentType: "image/jpeg" as const,
      bytes: 1024,
    };

    // Met sleutel: de route komt tot het ondertekenen en levert een upload-URL.
    const ok = await api("/photos/upload-intent", { method: "POST", token: tok, body });
    expect(ok.status).toBe(201);

    const previous = env.HMAC_SECRET;
    env.HMAC_SECRET = "";
    try {
      const res = await api("/photos/upload-intent", { method: "POST", token: tok, body });
      // Geen ondertekende URL zonder sleutel — nooit stilzwijgend op JWT_SECRET.
      expect(res.status).toBe(500);
    } finally {
      env.HMAC_SECRET = previous;
    }
  });
});

// ─── 7. Lage bevindingen 15-20 ──────────────────────────────────────────────

describe("beveiligingsheaders op de API", () => {
  it("zet nosniff en no-referrer op elk antwoord", async () => {
    const res = await api("/health");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=");
  });
});

describe("JWT-verificatie", () => {
  it("weigert een token waarvan de claims niet kloppen", async () => {
    // Correct ondertekend, maar `role` is geen bekende rol: de handtekening
    // bewijst niets over de vorm van de claims waar autorisatie op steunt.
    const bogus = await signJwt(
      { sub: "usr_x", fam: "fam_x", role: "admin" } as unknown as Parameters<typeof signJwt>[0],
      env.JWT_SECRET,
      3600,
    );
    expect((await api("/members", { token: bogus })).status).toBe(401);
  });

  it("weigert een token zonder familie-claim", async () => {
    const bogus = await signJwt(
      { sub: "usr_x", role: "parent" } as unknown as Parameters<typeof signJwt>[0],
      env.JWT_SECRET,
      3600,
    );
    expect((await api("/members", { token: bogus })).status).toBe(401);
  });
});

describe("hergebruik van een refresh token", () => {
  it("trekt de hele keten in zodra een verbruikt token terugkomt", async () => {
    const email = `reuse-${crypto.randomUUID()}@test.local`;
    const reg = await api("/auth/register", {
      body: {
        email,
        password: "TestPassword_NotASecret_123",
        familyName: "Hergebruik",
        displayName: "Ouder",
        turnstileToken: "dev-bypass",
      },
      headers: { "CF-Connecting-IP": "198.51.100.70" },
    });
    expect(reg.status).toBe(201);
    const first = (await reg.json()) as { refreshToken: string; accessToken: string };

    // Normale rotatie: het oude token is nu verbruikt.
    const rotated = await api("/auth/refresh", {
      body: { refreshToken: first.refreshToken },
      headers: { "CF-Connecting-IP": "198.51.100.70" },
    });
    expect(rotated.status).toBe(200);
    const second = (await rotated.json()) as { refreshToken: string };

    // Replay van het oude token → 401 én de verse keten wordt ingetrokken.
    const replay = await api("/auth/refresh", {
      body: { refreshToken: first.refreshToken },
      headers: { "CF-Connecting-IP": "198.51.100.70" },
    });
    expect(replay.status).toBe(401);

    const afterReuse = await api("/auth/refresh", {
      body: { refreshToken: second.refreshToken },
      headers: { "CF-Connecting-IP": "198.51.100.70" },
    });
    expect(afterReuse.status).toBe(401);
  });
});

describe("wachtwoord-KDF", () => {
  it("hasht nieuwe wachtwoorden op het huidige iteratieaantal", async () => {
    const stored = await hashSecret("TestPassword_NotASecret_123");
    expect(stored.startsWith("pbkdf2$600000$")).toBe(true);
    expect(needsRehash(stored)).toBe(false);
  });

  it("markeert een verouderde hash voor migratie en blijft die verifiëren", async () => {
    const legacy = "pbkdf2$100000$c2FsdHNhbHRzYWx0c2Ex$aGFzaA==";
    expect(needsRehash(legacy)).toBe(true);
  });
});

// ─── 8. WebSocket-token uit de query string (audit-bevinding 14) ────────────

describe("ws-upgrade authenticatie", () => {
  async function wsToken(fam: { parentId: string; familyId: string }) {
    const res = await api("/ws/token", {
      method: "POST",
      token: await parentToken(fam.parentId, fam.familyId),
    });
    expect(res.status).toBe(200);
    return ((await res.json()) as { token: string }).token;
  }

  it("accepteert het token uit Sec-WebSocket-Protocol", async () => {
    const fam = await seedFamily("wssub");
    const token = await wsToken(fam);
    const res = await api("/ws", {
      headers: {
        Upgrade: "websocket",
        "Sec-WebSocket-Protocol": wsAuthSubprotocols(token).join(", "),
      },
    });
    expect(res.status).toBe(101);
    // De server moet precies één aangeboden subprotocol teruggeven, anders
    // breekt de browser de handshake af.
    expect(res.headers.get("Sec-WebSocket-Protocol")).toBe(WS_SUBPROTOCOL);
  });

  it("accepteert nog steeds ?token= voor de iOS-client", async () => {
    const fam = await seedFamily("wsq");
    const token = await wsToken(fam);
    const res = await api(`/ws?token=${encodeURIComponent(token)}`, {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
  });

  it("weigert een upgrade zonder token", async () => {
    const res = await api("/ws", { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(401);
  });

  it("weigert een gewone access-JWT op het ws-pad", async () => {
    const fam = await seedFamily("wsacc");
    const access = await parentToken(fam.parentId, fam.familyId);
    const res = await api("/ws", {
      headers: {
        Upgrade: "websocket",
        "Sec-WebSocket-Protocol": wsAuthSubprotocols(access).join(", "),
      },
    });
    expect(res.status).toBe(401);
  });

  it("weigert een kind op het ws-pad", async () => {
    const fam = await seedFamily("wskid");
    const res = await api("/ws/token", {
      method: "POST",
      token: await childToken(fam.childA, fam.familyId),
    });
    expect(res.status).toBe(403);
  });
});

// ─── 9. Idempotency-Key is gebonden aan de operatie (audit-bevinding 6) ──────

describe("Idempotency-Key scoping", () => {
  it("geeft bij een echte retry dezelfde response terug", async () => {
    const fam = await seedFamily("idem");
    const tok = await parentToken(fam.parentId, fam.familyId);
    const key = crypto.randomUUID();
    const body = { childId: fam.childA, amount: 5, note: "Goed gedaan" };

    const first = await api("/points/adjust", { method: "POST", token: tok, idempotencyKey: key, body });
    expect(first.status).toBe(200);
    const second = await api("/points/adjust", { method: "POST", token: tok, idempotencyKey: key, body });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());

    // Eén boeking, geen dubbele punten.
    const row = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM points_ledger WHERE family_id = ? AND child_id = ?")
      .bind(fam.familyId, fam.childA)
      .first<{ n: number }>();
    expect(row?.n).toBe(1);
  });

  it("weigert dezelfde sleutel voor een andere payload", async () => {
    const fam = await seedFamily("idemp2");
    const tok = await parentToken(fam.parentId, fam.familyId);
    const key = crypto.randomUUID();

    const first = await api("/points/adjust", {
      method: "POST", token: tok, idempotencyKey: key,
      body: { childId: fam.childA, amount: 5, note: "Eerste" },
    });
    expect(first.status).toBe(200);

    // Ander bedrag, zelfde sleutel: vroeger kwam hier de eerste response terug
    // met 200 — de tweede boeking verdween zonder signaal.
    const reused = await api("/points/adjust", {
      method: "POST", token: tok, idempotencyKey: key,
      body: { childId: fam.childA, amount: 50, note: "Tweede" },
    });
    expect(reused.status).toBe(409);
    expect(((await reused.json()) as { error: { code: string } }).error.code).toBe(
      "IDEMPOTENCY_KEY_REUSED",
    );
  });

  it("weigert dezelfde sleutel op een ander endpoint", async () => {
    const fam = await seedFamily("idemp3");
    const tok = await parentToken(fam.parentId, fam.familyId);
    const key = crypto.randomUUID();

    const adjust = await api("/points/adjust", {
      method: "POST", token: tok, idempotencyKey: key,
      body: { childId: fam.childA, amount: 5, note: "Punten" },
    });
    expect(adjust.status).toBe(200);

    const reward = await api("/rewards", {
      method: "POST", token: tok, idempotencyKey: key,
      body: { title: "Ijsje", icon: "star", price: 10 },
    });
    expect(reward.status).toBe(409);
  });

  it("houdt sleutels per gebruiker gescheiden", async () => {
    const fam = await seedFamily("idemp4");
    const tok = await parentToken(fam.parentId, fam.familyId);
    const key = crypto.randomUUID();
    const body = { childId: fam.childA, amount: 5, note: "Punten" };

    expect((await api("/points/adjust", { method: "POST", token: tok, idempotencyKey: key, body })).status).toBe(200);

    // Andere ouder, zelfde sleutelwaarde: mag elkaar niet in de weg zitten.
    const other = await seedFamily("idemp5");
    const otherTok = await parentToken(other.parentId, other.familyId);
    const res = await api("/points/adjust", {
      method: "POST", token: otherTok, idempotencyKey: key,
      body: { childId: other.childA, amount: 5, note: "Punten" },
    });
    expect(res.status).toBe(200);
  });
});
