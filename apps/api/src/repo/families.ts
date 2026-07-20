/**
 * ENIGE laag met SQL. Elke functie eist familyId als eerste argument — dit is
 * de security-grens (D1 heeft geen row-level security). Zie CLAUDE.md regel 1.
 */
export async function getFamily(db: D1Database, familyId: string) {
  return db
    .prepare("SELECT * FROM families WHERE id = ? AND deleted_at IS NULL")
    .bind(familyId)
    .first();
}

export async function getMembers(db: D1Database, familyId: string) {
  return db
    .prepare(
      "SELECT id, role, display_name, avatar_id, age_mode FROM users WHERE family_id = ? AND deleted_at IS NULL",
    )
    .bind(familyId)
    .all();
}
