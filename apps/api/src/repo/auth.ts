/**
 * Auth-repo: de enige repo zonder familyId-parameter op elke functie.
 * Deze lookups draaien vóór authenticatie (login, gezinscode) en kunnen dus
 * nog niet aan een gezin gebonden zijn; alles ná de code/e-mail-lookup is
 * wél expliciet family-gescoped.
 */
import { newId } from "../services/ids";
import { sha256Hex } from "../services/passwords";

export async function getParentByEmail(db: D1Database, email: string) {
  return db
    .prepare(
      "SELECT * FROM users WHERE email = ? AND role = 'parent' AND deleted_at IS NULL",
    )
    .bind(email.toLowerCase())
    .first();
}

/**
 * Is dit e-mailadres al in gebruik? Bewust ZONDER deleted_at-filter: de
 * users.email UNIQUE-constraint negeert soft-deletes ook, dus een soft-deleted
 * rij zou anders alsnog een INSERT-conflict (500) geven i.p.v. een nette 409.
 */
export async function emailInUse(db: D1Database, email: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM users WHERE email = ? LIMIT 1")
    .bind(email.toLowerCase())
    .first();
  return row !== null;
}

export async function getParentByAppleSub(db: D1Database, appleSub: string) {
  return db
    .prepare(
      "SELECT * FROM users WHERE apple_sub = ? AND role = 'parent' AND deleted_at IS NULL",
    )
    .bind(appleSub)
    .first();
}

/** Apple-account koppelen aan een bestaand (e-mail)account met hetzelfde adres. */
export async function linkAppleSub(db: D1Database, userId: string, appleSub: string) {
  await db
    .prepare("UPDATE users SET apple_sub = ? WHERE id = ? AND deleted_at IS NULL")
    .bind(appleSub, userId)
    .run();
}

export async function getFamilyByInviteCode(db: D1Database, code: string) {
  return db
    .prepare("SELECT * FROM families WHERE invite_code = ? AND deleted_at IS NULL")
    .bind(code.toUpperCase())
    .first();
}

export async function getChildForLogin(db: D1Database, familyId: string, childId: string) {
  return db
    .prepare(
      "SELECT * FROM users WHERE family_id = ? AND id = ? AND role = 'child' AND deleted_at IS NULL",
    )
    .bind(familyId, childId)
    .first();
}

export async function listChildProfiles(db: D1Database, familyId: string) {
  const { results } = await db
    .prepare(
      "SELECT id, display_name, avatar_id FROM users WHERE family_id = ? AND role = 'child' AND deleted_at IS NULL ORDER BY created_at",
    )
    .bind(familyId)
    .all();
  return results.map((r) => ({
    id: r.id as string,
    displayName: r.display_name as string,
    avatarId: (r.avatar_id as string | null) ?? null,
  }));
}

export async function setPinLock(db: D1Database, familyId: string, childId: string, untilIso: string | null) {
  await db
    .prepare("UPDATE users SET pin_locked_until = ? WHERE family_id = ? AND id = ?")
    .bind(untilIso, familyId, childId)
    .run();
}

// --- refresh tokens (rotatie: oude vervalt zodra een nieuwe wordt uitgegeven) ---

export async function storeRefreshToken(db: D1Database, userId: string, token: string, ttlDays: number) {
  const expires = new Date(Date.now() + ttlDays * 24 * 3600 * 1000).toISOString();
  await db
    .prepare("INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(newId("rt"), userId, await sha256Hex(token), expires)
    .run();
}

export async function consumeRefreshToken(db: D1Database, token: string) {
  const hash = await sha256Hex(token);
  // Atomic single-use: flip revoked_at from NULL in one statement and only treat
  // the token as consumed when this call is the one that changed the row. This
  // closes the read-then-write race where two concurrent refreshes could both
  // pass a `revoked_at IS NULL` check and each rotate to a new token.
  const res = await db
    .prepare(
      "UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')",
    )
    .bind(hash)
    .run();
  if (!res.meta.changes) return null;
  return db.prepare("SELECT * FROM refresh_tokens WHERE token_hash = ?").bind(hash).first();
}

export async function revokeRefreshToken(db: D1Database, token: string) {
  await db
    .prepare("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ?")
    .bind(await sha256Hex(token))
    .run();
}

export async function getUserById(db: D1Database, userId: string) {
  return db.prepare("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL").bind(userId).first();
}

// --- registratie: gezin + eerste ouder in één batch (atomair) ---

export async function createFamilyWithParent(
  db: D1Database,
  input: {
    familyId: string;
    inviteCode: string;
    familyName: string;
    parentId: string;
    email: string | null; // Apple-only accounts kunnen zonder e-mail bestaan
    passwordHash: string | null; // NULL bij Sign in with Apple
    appleSub?: string | null;
    displayName: string;
  },
) {
  await db.batch([
    db
      .prepare("INSERT INTO families (id, name, invite_code) VALUES (?, ?, ?)")
      .bind(input.familyId, input.familyName, input.inviteCode),
    db
      .prepare(
        `INSERT INTO users (id, family_id, role, permissions, display_name, email, password_hash, apple_sub)
         VALUES (?, ?, 'parent', 'full', ?, ?, ?, ?)`,
      )
      .bind(
        input.parentId,
        input.familyId,
        input.displayName,
        input.email?.toLowerCase() ?? null,
        input.passwordHash,
        input.appleSub ?? null,
      ),
  ]);
}
