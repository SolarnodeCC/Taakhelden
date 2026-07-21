/**
 * ENIGE laag met SQL. Elke functie eist familyId als eerste argument — dit is
 * de security-grens (D1 heeft geen row-level security). Zie CLAUDE.md regel 1.
 */
import type { FamilyPatchBody } from "@taakhelden/shared";

export async function getFamily(db: D1Database, familyId: string) {
  return db
    .prepare("SELECT * FROM families WHERE id = ? AND deleted_at IS NULL")
    .bind(familyId)
    .first();
}

export async function getMembers(db: D1Database, familyId: string) {
  return db
    .prepare(
      `SELECT id, role, permissions, display_name, avatar_id, age_mode, birth_year, email
       FROM users WHERE family_id = ? AND deleted_at IS NULL ORDER BY created_at`,
    )
    .bind(familyId)
    .all();
}

export async function getMember(db: D1Database, familyId: string, memberId: string) {
  return db
    .prepare("SELECT * FROM users WHERE family_id = ? AND id = ? AND deleted_at IS NULL")
    .bind(familyId, memberId)
    .first();
}

export async function listChildren(db: D1Database, familyId: string) {
  const { results } = await db
    .prepare(
      "SELECT * FROM users WHERE family_id = ? AND role = 'child' AND deleted_at IS NULL ORDER BY created_at",
    )
    .bind(familyId)
    .all();
  return results;
}

const SETTINGS_COLUMNS: Record<string, string> = {
  name: "name",
  timezone: "timezone",
  quietStart: "quiet_start",
  quietEnd: "quiet_end",
  dayBonusPoints: "day_bonus_points",
  weekBonusPoints: "week_bonus_points",
  weekBonusThreshold: "week_bonus_threshold",
  vacationMode: "vacation_mode",
};

export async function updateFamilySettings(db: D1Database, familyId: string, patch: FamilyPatchBody) {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(SETTINGS_COLUMNS)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    sets.push(`${column} = ?`);
    values.push(typeof value === "boolean" ? (value ? 1 : 0) : value);
  }
  if (sets.length === 0) return;
  await db
    .prepare(`UPDATE families SET ${sets.join(", ")} WHERE id = ? AND deleted_at IS NULL`)
    .bind(...values, familyId)
    .run();
}

export async function setInviteCode(db: D1Database, familyId: string, code: string) {
  await db
    .prepare("UPDATE families SET invite_code = ? WHERE id = ? AND deleted_at IS NULL")
    .bind(code, familyId)
    .run();
}

export async function createChild(
  db: D1Database,
  familyId: string,
  input: {
    id: string;
    displayName: string;
    birthYear: number;
    ageMode: "young" | "mid" | "teen";
    avatarId: string | null;
    pincodeHash: string;
    consentBy: string; // AVG art. 8: welke ouder gaf toestemming
  },
) {
  await db
    .prepare(
      `INSERT INTO users (id, family_id, role, display_name, birth_year, age_mode, avatar_id,
                          pincode_hash, consent_by, consent_at)
       VALUES (?, ?, 'child', ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .bind(
      input.id,
      familyId,
      input.displayName,
      input.birthYear,
      input.ageMode,
      input.avatarId,
      input.pincodeHash,
      input.consentBy,
    )
    .run();
}

/**
 * Tweede verzorger: parent-rij zonder inloggegevens (pending). De ouder zet
 * later een wachtwoord via de uitnodigingslink. display_name is voorlopig het
 * lokale deel van het e-mailadres tot de uitnodiging geaccepteerd wordt.
 */
export async function createPendingParent(
  db: D1Database,
  familyId: string,
  input: { id: string; email: string; permissions: "full" | "approve_only" },
) {
  const placeholderName = input.email.split("@")[0] ?? "Ouder";
  await db
    .prepare(
      `INSERT INTO users (id, family_id, role, permissions, display_name, email)
       VALUES (?, ?, 'parent', ?, ?, ?)`,
    )
    .bind(input.id, familyId, input.permissions, placeholderName, input.email.toLowerCase())
    .run();
}

/**
 * Co-ouder accepteert de uitnodiging: zet wachtwoord (en optioneel roepnaam) op
 * het pending parent-profiel. Alleen als er nog geen wachtwoord staat — anders is
 * de uitnodiging al gebruikt. Geeft terug of er daadwerkelijk een rij is bijgewerkt
 * (atomair: voorkomt dubbel-accepteren).
 */
export async function activatePendingParent(
  db: D1Database,
  familyId: string,
  userId: string,
  input: { passwordHash: string; displayName?: string },
): Promise<boolean> {
  const sets = ["password_hash = ?"];
  const values: unknown[] = [input.passwordHash];
  if (input.displayName !== undefined) {
    sets.push("display_name = ?");
    values.push(input.displayName);
  }
  const res = await db
    .prepare(
      `UPDATE users SET ${sets.join(", ")}
       WHERE family_id = ? AND id = ? AND role = 'parent'
         AND password_hash IS NULL AND deleted_at IS NULL`,
    )
    .bind(...values, familyId, userId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

export async function updateMember(
  db: D1Database,
  familyId: string,
  memberId: string,
  patch: { displayName?: string; avatarId?: string; birthYear?: number; ageMode?: string },
) {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.displayName !== undefined) { sets.push("display_name = ?"); values.push(patch.displayName); }
  if (patch.avatarId !== undefined) { sets.push("avatar_id = ?"); values.push(patch.avatarId); }
  if (patch.birthYear !== undefined) { sets.push("birth_year = ?"); values.push(patch.birthYear); }
  if (patch.ageMode !== undefined) { sets.push("age_mode = ?"); values.push(patch.ageMode); }
  if (sets.length === 0) return;
  await db
    .prepare(`UPDATE users SET ${sets.join(", ")} WHERE family_id = ? AND id = ? AND deleted_at IS NULL`)
    .bind(...values, familyId, memberId)
    .run();
}

export async function setMemberPincode(db: D1Database, familyId: string, memberId: string, pincodeHash: string) {
  await db
    .prepare(
      "UPDATE users SET pincode_hash = ?, pin_locked_until = NULL WHERE family_id = ? AND id = ? AND role = 'child'",
    )
    .bind(pincodeHash, familyId, memberId)
    .run();
}

/** Soft delete (7 dagen venster); cascade volgt in het account-verwijderproces. */
export async function softDeleteMember(db: D1Database, familyId: string, memberId: string) {
  await db
    .prepare("UPDATE users SET deleted_at = datetime('now') WHERE family_id = ? AND id = ?")
    .bind(familyId, memberId)
    .run();
}
