/**
 * SQL rond badges. Zoals elke repo: familyId is de eerste (verplichte)
 * scoping-parameter — child_badges heeft geen family_id, dus we scopen via een
 * join op users(id) binnen het gezin (CLAUDE.md regel 1).
 */
import type { BadgeStats } from "../services/badges";

export interface BadgeRow {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export async function listCatalogue(db: D1Database): Promise<BadgeRow[]> {
  const { results } = await db
    .prepare("SELECT id, title, description, icon FROM badges ORDER BY id")
    .all<BadgeRow>();
  return results;
}

export async function getBadges(db: D1Database, ids: string[]): Promise<BadgeRow[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const { results } = await db
    .prepare(`SELECT id, title, description, icon FROM badges WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<BadgeRow>();
  return results;
}

export interface EarnedBadge {
  badgeId: string;
  earnedAt: string;
}

export async function listEarned(
  db: D1Database,
  familyId: string,
  childId: string,
): Promise<EarnedBadge[]> {
  const { results } = await db
    .prepare(
      `SELECT cb.badge_id AS badgeId, cb.earned_at AS earnedAt
       FROM child_badges cb JOIN users u ON u.id = cb.child_id
       WHERE u.family_id = ? AND cb.child_id = ?`,
    )
    .bind(familyId, childId)
    .all<EarnedBadge>();
  return results;
}

export async function listEarnedIds(
  db: D1Database,
  familyId: string,
  childId: string,
): Promise<Set<string>> {
  const rows = await listEarned(db, familyId, childId);
  return new Set(rows.map((r) => r.badgeId));
}

/**
 * Kent een badge toe. INSERT OR IGNORE maakt het idempotent (PK child+badge);
 * de EXISTS-guard bewaakt de gezinsgrens. Retourneert true als er echt een
 * nieuwe rij bij kwam.
 */
export async function award(
  db: D1Database,
  familyId: string,
  childId: string,
  badgeId: string,
): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO child_badges (child_id, badge_id)
       SELECT ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ? AND family_id = ?)`,
    )
    .bind(childId, badgeId, childId, familyId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

/** Verzamelt de tellingen die de badge-regels nodig hebben. */
export async function collectStats(
  db: D1Database,
  familyId: string,
  childId: string,
  streakDays: number,
  balance: number,
): Promise<BadgeStats> {
  const [taskRow, hwRow, weekRow] = await Promise.all([
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM points_ledger WHERE family_id = ? AND child_id = ? AND type = 'task'",
      )
      .bind(familyId, childId)
      .first<{ c: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM task_instances ti JOIN tasks t ON t.id = ti.task_id
         WHERE ti.family_id = ? AND ti.child_id = ? AND ti.status = 'approved' AND t.category = 'homework'`,
      )
      .bind(familyId, childId)
      .first<{ c: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM points_ledger WHERE family_id = ? AND child_id = ? AND type = 'week_bonus'",
      )
      .bind(familyId, childId)
      .first<{ c: number }>(),
  ]);
  return {
    taskCount: taskRow?.c ?? 0,
    homeworkCount: hwRow?.c ?? 0,
    weekBonusCount: weekRow?.c ?? 0,
    streakDays,
    balance,
  };
}
