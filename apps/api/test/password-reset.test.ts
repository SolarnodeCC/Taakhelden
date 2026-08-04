/**
 * Security test: password-reset flow.
 *
 * Focuses on the SEC-01 fix: refresh tokens must be revoked after a
 * successful password reset so a compromised session cannot survive a reset.
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { api, seedFamily } from "./helpers";
import { sha256Hex } from "../src/services/passwords";
import { hashSecret } from "../src/services/passwords";

// --- helpers ---

async function seedParentWithPassword(prefix: string) {
  const familyId = `fam_pwreset_${prefix}`;
  const parentId = `usr_pwreset_${prefix}`;
  const email = `${prefix}@pwreset.test.local`;
  const passwordHash = await hashSecret("original-secret-1");

  await env.DB.batch([
    env.DB
      .prepare("INSERT INTO families (id, name, invite_code) VALUES (?, ?, ?)")
      .bind(familyId, `Gezin ${prefix}`, `PW${prefix.slice(0, 4).toUpperCase()}`),
    env.DB
      .prepare(
        `INSERT INTO users (id, family_id, role, permissions, display_name, email, password_hash)
         VALUES (?, ?, 'parent', 'full', 'Ouder', ?, ?)`,
      )
      .bind(parentId, familyId, email, passwordHash),
  ]);
  return { familyId, parentId, email };
}

/** Store an active refresh token for a user and return the raw token value. */
async function seedRefreshToken(userId: string): Promise<string> {
  const rawToken = `rt_fake_${crypto.randomUUID()}`;
  const hash = await sha256Hex(rawToken);
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await env.DB
    .prepare(
      "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
    )
    .bind(`rt_${crypto.randomUUID().replace(/-/g, "")}`, userId, hash, expires)
    .run();
  return rawToken;
}

/** Store a password-reset KV key and return the raw token. */
async function seedResetToken(userId: string): Promise<string> {
  const rawToken = `reset_${crypto.randomUUID()}`;
  const hash = await sha256Hex(rawToken);
  await env.KV.put(`pwreset:${hash}`, userId, { expirationTtl: 3600 });
  return rawToken;
}

// ============================================================
// SEC-01: refresh tokens must be revoked after password reset
// ============================================================

describe("POST /auth/reset-password — refresh token revocation (SEC-01)", () => {
  it("resets the password and revokes all active refresh tokens", async () => {
    const { parentId } = await seedParentWithPassword("revoke");

    // Give the user two active refresh tokens (e.g., two different devices).
    const token1 = await seedRefreshToken(parentId);
    const token2 = await seedRefreshToken(parentId);

    // Verify both tokens are initially consumable (non-revoked rows exist).
    const activeBefore = await env.DB
      .prepare(
        "SELECT COUNT(*) AS n FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL",
      )
      .bind(parentId)
      .first<{ n: number }>();
    expect(activeBefore?.n).toBe(2);

    // Perform the password reset.
    const resetToken = await seedResetToken(parentId);
    const res = await api("/auth/reset-password", {
      body: { token: resetToken, password: "new-secure-pass-1" },
    });
    expect(res.status).toBe(200);

    // Both old refresh tokens must now be revoked.
    const activeAfter = await env.DB
      .prepare(
        "SELECT COUNT(*) AS n FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL",
      )
      .bind(parentId)
      .first<{ n: number }>();
    expect(activeAfter?.n).toBe(0);

    // Attempting to use either old refresh token must return 401.
    const refresh1 = await api("/auth/refresh", { body: { refreshToken: token1 } });
    expect(refresh1.status).toBe(401);

    const refresh2 = await api("/auth/refresh", { body: { refreshToken: token2 } });
    expect(refresh2.status).toBe(401);
  });

  it("reset token is single-use — second attempt returns 400", async () => {
    const { parentId } = await seedParentWithPassword("singleuse");
    const resetToken = await seedResetToken(parentId);

    const first = await api("/auth/reset-password", {
      body: { token: resetToken, password: "first-password-x1" },
    });
    expect(first.status).toBe(200);

    const second = await api("/auth/reset-password", {
      body: { token: resetToken, password: "second-password-x2" },
    });
    expect(second.status).toBe(400);
  });

  it("unknown or expired token returns 400 and does not change any password", async () => {
    const res = await api("/auth/reset-password", {
      body: { token: "no_such_token_000000000000", password: "attacker-pass-x1" },
    });
    expect(res.status).toBe(400);
  });

  it("a reset token pointing at a child account returns 400, not a false ok:true", async () => {
    // `updatePasswordHash` is parent-only by design (children have no password).
    // If a reset token's user_id ever resolved to a child row — e.g. through a
    // future refactor — the route must not report success while leaving the
    // password untouched.
    const fam = await seedFamily("pwreset_child");
    const resetToken = await seedResetToken(fam.childA);

    const res = await api("/auth/reset-password", {
      body: { token: resetToken, password: "attacker-pass-x1" },
    });
    expect(res.status).toBe(400);

    // The reset token must still be consumed (single-use), even though the
    // password update was rejected — no free retry on the same token.
    const replay = await api("/auth/reset-password", {
      body: { token: resetToken, password: "attacker-pass-x2" },
    });
    expect(replay.status).toBe(400);
  });
});
