/**
 * ENIGE laag met SQL voor insights. familyId is het eerste argument — security-grens.
 * Alle aggregaties zijn read-only: geen ledger-writes, geen DO.
 */
import { weekDates } from "../services/time";
import { computeStreak } from "../services/pointsEngine";

export interface SlippingTask {
  taskId: string;
  title: string;
  icon: string;
  missed: number;
}

export interface ChildInsightsData {
  childId: string;
  displayName: string;
  earned: number;
  spent: number;
  net: number;
  tasksApproved: number;
  tasksTotal: number;
  completionRate: number;
  streakDays: number;
  slippingTasks: SlippingTask[];
}

/**
 * Aggregeer weekinzichten voor het gezin (optioneel gefilterd op één kind).
 * weekOf = maandag van de week (YYYY-MM-DD, ISO).
 * earned = som van positieve ledger-bedragen die week (excl. redemption_cancel).
 * spent = magnitude van redemptions die week.
 * slippingTasks = top-5 taken die week het vaakst open/open_redo bleven.
 */
export async function weeklyInsights(
  db: D1Database,
  familyId: string,
  opts: { weekOf: string; childId?: string },
): Promise<{ weekOf: string; children: ChildInsightsData[] }> {
  const dates = weekDates(opts.weekOf);
  const startDate = dates[0]!; // maandag
  const endDate = dates[6]!;   // zondag

  // Haal kinderen op (één of allemaal)
  let childRows: Array<{ id: string; display_name: string }>;
  if (opts.childId) {
    const row = await db
      .prepare(
        "SELECT id, display_name FROM users WHERE family_id = ? AND id = ? AND role = 'child' AND deleted_at IS NULL",
      )
      .bind(familyId, opts.childId)
      .first<{ id: string; display_name: string }>();
    childRows = row ? [row] : [];
  } else {
    const { results } = await db
      .prepare(
        "SELECT id, display_name FROM users WHERE family_id = ? AND role = 'child' AND deleted_at IS NULL ORDER BY created_at",
      )
      .bind(familyId)
      .all<{ id: string; display_name: string }>();
    childRows = results;
  }

  const today = new Date().toISOString().slice(0, 10);

  const children: ChildInsightsData[] = [];
  for (const child of childRows) {
    const childId = child.id;

    // Batch: ledger-aggregaten + taak-stats + slippende taken + dagbonus-datums
    const batchResults = await db.batch([
      db
        .prepare(
          `SELECT
            COALESCE(SUM(CASE WHEN amount > 0 AND type != 'redemption_cancel' THEN amount ELSE 0 END), 0) AS earned,
            COALESCE(SUM(CASE WHEN type = 'redemption' THEN ABS(amount) ELSE 0 END), 0) AS spent
           FROM points_ledger
           WHERE family_id = ? AND child_id = ? AND date(created_at) BETWEEN ? AND ?`,
        )
        .bind(familyId, childId, startDate, endDate),

      db
        .prepare(
          `SELECT
            COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approved
           FROM task_instances
           WHERE family_id = ? AND child_id = ? AND date BETWEEN ? AND ?`,
        )
        .bind(familyId, childId, startDate, endDate),

      db
        .prepare(
          `SELECT t.id AS task_id, t.title, t.icon, COUNT(*) AS missed
           FROM task_instances ti
           JOIN tasks t ON t.id = ti.task_id AND t.family_id = ?
           WHERE ti.family_id = ? AND ti.child_id = ? AND ti.date BETWEEN ? AND ?
             AND ti.status IN ('open', 'open_redo')
           GROUP BY t.id, t.title, t.icon
           ORDER BY missed DESC
           LIMIT 5`,
        )
        .bind(familyId, familyId, childId, startDate, endDate),

      db
        .prepare(
          `SELECT ref_id FROM points_ledger
           WHERE family_id = ? AND child_id = ? AND type = 'day_bonus'
           ORDER BY ref_id DESC LIMIT 60`,
        )
        .bind(familyId, childId),
    ]);

    const [ledgerResult, taskResult, slippingResult, bonusResult] = batchResults;

    const ledgerRow = ((ledgerResult?.results[0] ?? { earned: 0, spent: 0 })) as {
      earned: number;
      spent: number;
    };
    const taskRow = ((taskResult?.results[0] ?? { total: 0, approved: 0 })) as {
      total: number;
      approved: number;
    };
    const slippingRows = (slippingResult?.results ?? []) as Array<{
      task_id: string;
      title: string;
      icon: string;
      missed: number;
    }>;
    const bonusDates = (bonusResult?.results ?? []).map((r) => (r as { ref_id: string }).ref_id);

    const earned = Number(ledgerRow.earned);
    const spent = Number(ledgerRow.spent);
    const tasksTotal = Number(taskRow.total);
    const tasksApproved = Number(taskRow.approved);

    children.push({
      childId,
      displayName: child.display_name,
      earned,
      spent,
      net: earned - spent,
      tasksApproved,
      tasksTotal,
      completionRate: tasksTotal === 0 ? 0 : tasksApproved / tasksTotal,
      streakDays: computeStreak(bonusDates, today),
      slippingTasks: slippingRows.map((r) => ({
        taskId: r.task_id,
        title: r.title,
        icon: r.icon,
        missed: Number(r.missed),
      })),
    });
  }

  return { weekOf: opts.weekOf, children };
}
