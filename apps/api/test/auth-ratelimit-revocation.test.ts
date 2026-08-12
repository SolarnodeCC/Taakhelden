/**
 * Regressietests bij de uitgebreide security-audit (augustus 2026).
 *
 * Twee gaten die allebei reproduceerbaar waren op `main`:
 *  - AUDIT-1: de limieten op /auth/forgot-password en /auth/reset-password
 *    hingen volledig aan het client-IP. Kwam dat niet door (de web-BFF stuurde
 *    voor deze twee routes geen X-Forwarded-For mee), dan kreeg élke request een
 *    eigen sleutel en gold er in de praktijk geen limiet.
 *  - AUDIT-2: een wachtwoordreset trok wel de refresh tokens in, maar niet het
 *    lopende access-token — precies de sessie waar de reset vanaf moest.
 */
import { describe, it, expect } from "vitest";
import { env, SELF } from "cloudflare:test";
import { sha256Hex, hashSecret } from "../src/services/passwords";
import { signJwt } from "../src/services/jwt";

async function seedParent(prefix: string) {
  const familyId = `fam_audit_${prefix}`;
  const parentId = `usr_audit_${prefix}`;
  const email = `${prefix}@audit.test.local`;
  await env.DB.batch([
    env.DB
      .prepare("INSERT INTO families (id, name, invite_code) VALUES (?, ?, ?)")
      .bind(familyId, `Gezin ${prefix}`, `AU${prefix.slice(0, 4).toUpperCase()}`),
    env.DB
      .prepare(
        `INSERT INTO users (id, family_id, role, permissions, display_name, email, password_hash)
         VALUES (?, ?, 'parent', 'full', 'Ouder', ?, ?)`,
      )
      .bind(parentId, familyId, email, await hashSecret("original-secret-1")),
  ]);
  return { familyId, parentId, email };
}

/** Roept de route aan zoals de web-BFF dat deed: zonder enige IP-header. */
function postWithoutClientIp(path: string, body: unknown) {
  return SELF.fetch(`https://api.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("AUDIT-1: publieke auth-routes blijven begrensd zonder client-IP", () => {
  it("throttelt forgot-password per e-mailadres, ook als het IP ontbreekt", async () => {
    const { email } = await seedParent("rl1");

    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      statuses.push((await postWithoutClientIp("/v1/auth/forgot-password", { email })).status);
    }

    // De per-adres limiet is 3/uur; daarna moet het dichtslaan.
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses.slice(3).every((s) => s === 429)).toBe(true);
  });

  it("lekt via de 429 niet of een e-mailadres bestaat", async () => {
    // Een onbekend adres moet exact hetzelfde gedrag vertonen als een bekend adres.
    const unknown = "nobody@audit.test.local";
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push((await postWithoutClientIp("/v1/auth/forgot-password", { email: unknown })).status);
    }
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses.slice(3).every((s) => s === 429)).toBe(true);
  });

  it("throttelt reset-password per account, ook als het IP ontbreekt", async () => {
    const { parentId } = await seedParent("rl2");

    // Zes geldige, losse reset-tokens: de limiet moet op het account pakken,
    // niet op het token (dat een aanvaller per poging kan variëren).
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const token = `reset_${crypto.randomUUID()}`;
      await env.KV.put(`pwreset:${await sha256Hex(token)}`, parentId, { expirationTtl: 3600 });
      const res = await postWithoutClientIp("/v1/auth/reset-password", {
        token,
        password: `rotated-secret-${i}`,
      });
      statuses.push(res.status);
    }
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});

describe("AUDIT-2: wachtwoordreset beëindigt de lopende sessie", () => {
  it("maakt een al uitgegeven access-token ongeldig", async () => {
    const { familyId, parentId } = await seedParent("rev1");

    // Een levend access-token, zoals een sessiedief dat zou hebben.
    const stolen = await signJwt(
      { sub: parentId, fam: familyId, role: "parent", perm: "full" },
      env.JWT_SECRET,
      3600,
    );
    const before = await SELF.fetch("https://api.test/v1/families/me", {
      headers: { Authorization: `Bearer ${stolen}` },
    });
    expect(before.status).toBe(200);

    const resetToken = `reset_${crypto.randomUUID()}`;
    await env.KV.put(`pwreset:${await sha256Hex(resetToken)}`, parentId, { expirationTtl: 3600 });
    const reset = await postWithoutClientIp("/v1/auth/reset-password", {
      token: resetToken,
      password: "brand-new-secret-9",
    });
    expect(reset.status).toBe(200);

    const after = await SELF.fetch("https://api.test/v1/families/me", {
      headers: { Authorization: `Bearer ${stolen}` },
    });
    expect(after.status).toBe(401);
  });
});
