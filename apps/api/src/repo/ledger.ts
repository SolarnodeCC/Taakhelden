import { newId } from "../services/ids";

export type LedgerEntryType =
  | "task" | "photo_bonus" | "day_bonus" | "week_bonus"
  | "redemption" | "redemption_cancel" | "adjustment" | "badge";

/**
 * Ledger-writes horen ALTIJD via de FamilyRoom-DO te lopen (serialisatie).
 * Saldo = som van de ledger — nooit een los saldoveld (CLAUDE.md regel 3).
 */
export async function insertEntry(
  db: D1Database,
  familyId: string,
  input: { childId: string; type: LedgerEntryType; amount: number; refId?: string; note?: string },
) {
  const id = newId("pl");
  await db
    .prepare(
      `INSERT INTO points_ledger (id, family_id, child_id, type, amount, ref_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, familyId, input.childId, input.type, input.amount, input.refId ?? null, input.note ?? null)
    .run();
  return id;
}

export async function balance(db: D1Database, familyId: string, childId: string): Promise<number> {
  const row = await db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS balance FROM points_ledger WHERE family_id = ? AND child_id = ?")
    .bind(familyId, childId)
    .first<{ balance: number }>();
  return row?.balance ?? 0;
}

/** Is deze bonus (dag/week/foto met deze ref) al geboekt? */
export async function bonusExists(
  db: D1Database,
  familyId: string,
  childId: string,
  type: "day_bonus" | "week_bonus" | "photo_bonus",
  refId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT 1 FROM points_ledger WHERE family_id = ? AND child_id = ? AND type = ? AND ref_id = ? LIMIT 1",
    )
    .bind(familyId, childId, type, refId)
    .first();
  return row !== null;
}

/** Paginated grootboek, nieuwste eerst. Cursor = (created_at, id) van de laatste rij. */
export async function listEntries(
  db: D1Database,
  familyId: string,
  childId: string,
  opts: { limit: number; cursor?: { createdAt: string; id: string } },
) {
  const conditions = ["family_id = ?", "child_id = ?"];
  const values: unknown[] = [familyId, childId];
  if (opts.cursor) {
    conditions.push("(created_at < ? OR (created_at = ? AND id < ?))");
    values.push(opts.cursor.createdAt, opts.cursor.createdAt, opts.cursor.id);
  }
  const { results } = await db
    .prepare(
      `SELECT id, type, amount, ref_id, note, created_at FROM points_ledger
       WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .bind(...values, opts.limit + 1)
    .all();
  return results;
}

/** Ledger-entries van na `since` (sync-delta). childId = null → alle kinderen (ouder). */
export async function entriesSince(
  db: D1Database,
  familyId: string,
  since: string,
  childId?: string,
) {
  const conditions = ["family_id = ?", "created_at > ?"];
  const values: unknown[] = [familyId, since];
  if (childId) { conditions.push("child_id = ?"); values.push(childId); }
  const { results } = await db
    .prepare(
      `SELECT id, child_id, type, amount, ref_id, note, created_at FROM points_ledger
       WHERE ${conditions.join(" AND ")} ORDER BY created_at LIMIT 500`,
    )
    .bind(...values)
    .all();
  return results;
}

/** Opeenvolgende dagen (t/m vandaag of gisteren) met dagbonus — de streak. */
export async function dayBonusDates(db: D1Database, familyId: string, childId: string, limit = 60) {
  const { results } = await db
    .prepare(
      `SELECT ref_id FROM points_ledger
       WHERE family_id = ? AND child_id = ? AND type = 'day_bonus'
       ORDER BY ref_id DESC LIMIT ?`,
    )
    .bind(familyId, childId, limit)
    .all();
  return results.map((r) => r.ref_id as string);
}
