/**
 * Read-only aggregaties voor het ouder-inzichtenscherm. Elke functie is
 * family-gescoped (CLAUDE.md regel 1) en raakt nooit een schrijfpad. De
 * weekindeling is bij benadering (UTC-week uit created_at) — voldoende voor een
 * trendgrafiek, geen boekhoudkundige grens.
 */

/** Verdiend / uitgegeven / saldo per kind (incl. kinderen zonder ledger). */
export async function childTotals(db: D1Database, familyId: string) {
  const { results } = await db
    .prepare(
      `SELECT u.id AS child_id, u.display_name,
              COALESCE(SUM(CASE WHEN pl.amount > 0 THEN pl.amount ELSE 0 END), 0) AS earned,
              COALESCE(SUM(CASE WHEN pl.amount < 0 THEN -pl.amount ELSE 0 END), 0) AS spent,
              COALESCE(SUM(pl.amount), 0) AS balance
       FROM users u
       LEFT JOIN points_ledger pl ON pl.child_id = u.id AND pl.family_id = ?
       WHERE u.family_id = ? AND u.role = 'child' AND u.deleted_at IS NULL
       GROUP BY u.id, u.display_name
       ORDER BY u.created_at`,
    )
    .bind(familyId, familyId)
    .all<{ child_id: string; display_name: string; earned: number; spent: number; balance: number }>();
  return results;
}

/** Verdiende punten per kind per ISO-week sinds `sinceModifier` (bijv. '-56 days'). */
export async function weeklyEarned(db: D1Database, familyId: string, sinceModifier: string) {
  const { results } = await db
    .prepare(
      `SELECT child_id,
              strftime('%Y-%W', created_at) AS week,
              COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS earned
       FROM points_ledger
       WHERE family_id = ? AND created_at >= datetime('now', ?)
       GROUP BY child_id, week
       ORDER BY week`,
    )
    .bind(familyId, sinceModifier)
    .all<{ child_id: string; week: string; earned: number }>();
  return results;
}

/** Taken die sinds `sinceDate` (lokale YYYY-MM-DD) blijven liggen (open > 0). */
export async function tasksNeedingAttention(db: D1Database, familyId: string, sinceDate: string) {
  const { results } = await db
    .prepare(
      `SELECT ti.task_id, t.title,
              COUNT(*) AS total,
              SUM(CASE WHEN ti.status IN ('approved','completed') THEN 1 ELSE 0 END) AS done,
              SUM(CASE WHEN ti.status IN ('open','open_redo') THEN 1 ELSE 0 END) AS open
       FROM task_instances ti
       JOIN tasks t ON t.id = ti.task_id
       WHERE ti.family_id = ? AND ti.date >= ?
       GROUP BY ti.task_id, t.title
       HAVING open > 0
       ORDER BY open DESC, total DESC
       LIMIT 10`,
    )
    .bind(familyId, sinceDate)
    .all<{ task_id: string; title: string; total: number; done: number; open: number }>();
  return results;
}
