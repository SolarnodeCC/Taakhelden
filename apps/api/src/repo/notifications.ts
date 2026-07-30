/**
 * Notificatie-instellingen per kind (§3.10). Een ontbrekende rij betekent de
 * standaard: aan, met het gezinsvenster (quiet hours) als tijdvenster.
 * Family-gescoped via users.family_id (CLAUDE.md regel 1).
 */
export interface NotificationSettingRow {
  child_id: string;
  enabled: number;
  quiet_start: string | null;
  quiet_end: string | null;
}

export async function listSettings(
  db: D1Database,
  familyId: string,
): Promise<NotificationSettingRow[]> {
  const { results } = await db
    .prepare(
      `SELECT u.id AS child_id,
              COALESCE(ns.enabled, 1) AS enabled,
              ns.quiet_start, ns.quiet_end
       FROM users u LEFT JOIN notification_settings ns ON ns.child_id = u.id
       WHERE u.family_id = ? AND u.role = 'child' AND u.deleted_at IS NULL
       ORDER BY u.created_at`,
    )
    .bind(familyId)
    .all<NotificationSettingRow>();
  return results;
}

export async function getSetting(
  db: D1Database,
  familyId: string,
  childId: string,
): Promise<NotificationSettingRow | null> {
  return db
    .prepare(
      `SELECT u.id AS child_id,
              COALESCE(ns.enabled, 1) AS enabled,
              ns.quiet_start, ns.quiet_end
       FROM users u LEFT JOIN notification_settings ns ON ns.child_id = u.id
       WHERE u.family_id = ? AND u.id = ? AND u.role = 'child' AND u.deleted_at IS NULL`,
    )
    .bind(familyId, childId)
    .first<NotificationSettingRow>();
}

/**
 * Upsert settings only when `childId` belongs to `familyId`.
 * Returns false when the child is not in the family (no write).
 */
export async function upsertSetting(
  db: D1Database,
  familyId: string,
  childId: string,
  values: { enabled: boolean; quietStart: string | null; quietEnd: string | null },
): Promise<boolean> {
  const member = await db
    .prepare(
      `SELECT id FROM users
       WHERE id = ? AND family_id = ? AND role = 'child' AND deleted_at IS NULL`,
    )
    .bind(childId, familyId)
    .first();
  if (!member) return false;

  await db
    .prepare(
      `INSERT INTO notification_settings (child_id, enabled, quiet_start, quiet_end, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(child_id) DO UPDATE SET
         enabled = excluded.enabled,
         quiet_start = excluded.quiet_start,
         quiet_end = excluded.quiet_end,
         updated_at = excluded.updated_at`,
    )
    .bind(childId, values.enabled ? 1 : 0, values.quietStart, values.quietEnd)
    .run();
  return true;
}
