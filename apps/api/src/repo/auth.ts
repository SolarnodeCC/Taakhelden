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

/** Wachtwoordhash vervangen — voor migratie naar sterkere KDF-parameters. */
export async function updatePasswordHash(db: D1Database, userId: string, passwordHash: string) {
  await db
    .prepare("UPDATE users SET password_hash = ? WHERE id = ? AND deleted_at IS NULL")
    .bind(passwordHash, userId)
    .run();
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

/**
 * Boekt één mislukte pincode-poging en zet zo nodig de lock — in één atomaire
 * UPDATE, zodat gelijktijdige pogingen elkaar niet overschrijven. De teller
 * stond eerder in KV (read-then-write op eventually consistent storage), waardoor
 * parallelle pogingen vanaf verschillende edge-locaties de lock konden ontlopen.
 *
 * De lock loopt exponentieel op per volle ronde van `maxAttempts` mislukkingen,
 * zodat herhaald proberen steeds duurder wordt.
 */
export async function registerPinFailure(
  db: D1Database,
  familyId: string,
  childId: string,
  opts: { maxAttempts: number; baseLockMinutes: number; maxLockMinutes: number },
): Promise<{ attempts: number; lockedUntil: string | null; justLocked: boolean }> {
  // Statische SQL, uitsluitend gebonden waarden — ook de ophoogstap.
  const row = await db
    .prepare(
      `UPDATE users
          SET pin_fail_count = pin_fail_count + ?
        WHERE family_id = ? AND id = ? AND role = 'child' AND deleted_at IS NULL
        RETURNING pin_fail_count`,
    )
    .bind(1, familyId, childId)
    .first<{ pin_fail_count: number }>();
  if (!row) return { attempts: 0, lockedUntil: null, justLocked: false };

  const attempts = row.pin_fail_count;
  if (attempts < opts.maxAttempts) return { attempts, lockedUntil: null, justLocked: false };

  const cycles = Math.floor(attempts / opts.maxAttempts);
  const minutes = Math.min(opts.baseLockMinutes * 2 ** (cycles - 1), opts.maxLockMinutes);
  const lockedUntil = new Date(Date.now() + minutes * 60_000).toISOString();
  await db
    .prepare(
      "UPDATE users SET pin_locked_until = ? WHERE family_id = ? AND id = ? AND role = 'child' AND deleted_at IS NULL",
    )
    .bind(lockedUntil, familyId, childId)
    .run();
  // Alleen op de eerste poging van een nieuwe ronde ouders lastigvallen.
  return { attempts, lockedUntil, justLocked: attempts % opts.maxAttempts === 0 };
}

/** Geslaagde login (of nieuwe pincode): teller en lock schoon. */
export async function clearPinFailures(db: D1Database, familyId: string, childId: string) {
  await db
    .prepare(
      "UPDATE users SET pin_fail_count = 0, pin_locked_until = NULL WHERE family_id = ? AND id = ? AND role = 'child'",
    )
    .bind(familyId, childId)
    .run();
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
      "SELECT id, display_name, avatar_id, age_mode FROM users WHERE family_id = ? AND role = 'child' AND deleted_at IS NULL ORDER BY created_at",
    )
    .bind(familyId)
    .all();
  return results.map((r) => ({
    id: r.id as string,
    displayName: r.display_name as string,
    avatarId: (r.avatar_id as string | null) ?? null,
    ageMode: ((r.age_mode as string | null) ?? "mid") as "young" | "mid" | "teen",
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

/**
 * Werd een al-verbruikt refresh token opnieuw aangeboden?
 *
 * Rotatie is single-use, dus een replay faalt sowieso. Maar een replay is óók
 * hét signaal dat iemand anders het token in handen heeft: de legitieme client
 * heeft het al ingewisseld. Dan is de hele keten verdacht, niet alleen dit token.
 * Geeft de eigenaar terug zodat de aanroeper alles kan intrekken.
 */
export async function detectRefreshReuse(db: D1Database, token: string) {
  return db
    .prepare("SELECT user_id FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NOT NULL")
    .bind(await sha256Hex(token))
    .first<{ user_id: string }>();
}

/** Alle nog geldige refresh tokens van één gebruiker intrekken. */
export async function revokeAllRefreshTokens(db: D1Database, userId: string): Promise<number> {
  const res = await db
    .prepare("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL")
    .bind(userId)
    .run();
  return res.meta.changes ?? 0;
}

/** Geeft de ingetrokken rij terug, zodat de aanroeper ook het access-token kan intrekken. */
export async function revokeRefreshToken(db: D1Database, token: string) {
  const hash = await sha256Hex(token);
  await db
    .prepare("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ?")
    .bind(hash)
    .run();
  return db
    .prepare("SELECT user_id FROM refresh_tokens WHERE token_hash = ?")
    .bind(hash)
    .first<{ user_id: string }>();
}

export async function storeChildDeviceSession(
  db: D1Database,
  familyId: string,
  childId: string,
  token: string,
  ttlDays: number,
) {
  const expires = new Date(Date.now() + ttlDays * 24 * 3600 * 1000).toISOString();
  await db
    .prepare(
      `INSERT INTO child_device_sessions (id, family_id, child_id, token_hash, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(newId("cds"), familyId, childId, await sha256Hex(token), expires)
    .run();
}

export async function consumeChildDeviceSession(db: D1Database, token: string) {
  const hash = await sha256Hex(token);
  const res = await db
    .prepare(
      `UPDATE child_device_sessions
       SET revoked_at = datetime('now'), last_used_at = datetime('now')
       WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')`,
    )
    .bind(hash)
    .run();
  if (!res.meta.changes) return null;
  return db.prepare("SELECT * FROM child_device_sessions WHERE token_hash = ?").bind(hash).first();
}

export async function revokeChildDeviceSessions(
  db: D1Database,
  familyId: string,
  childId: string,
): Promise<number> {
  const res = await db
    .prepare(
      `UPDATE child_device_sessions
       SET revoked_at = datetime('now')
       WHERE family_id = ? AND child_id = ? AND revoked_at IS NULL`,
    )
    .bind(familyId, childId)
    .run();
  return res.meta.changes ?? 0;
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
