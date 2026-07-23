/**
 * Ouder-inzichten (§ productvoorstel: trends, blijvend-open taken, verdiend vs.
 * uitgegeven). Read-only en alleen voor ouders — kinderen krijgen 403. Alles
 * afgeleid uit ledger + task-instances via repo/insights (geen schrijfpaden).
 */
import { Hono } from "hono";
import type { AppBindings } from "../types";
import { requireParent } from "../middleware/authz";
import { getFamily } from "../repo/families";
import { childTotals, weeklyEarned, tasksNeedingAttention } from "../repo/insights";
import { localDate } from "../services/time";

const PERIOD_DAYS = 56; // ~8 weken trend

const insights = new Hono<AppBindings>();

insights.get("/", async (c) => {
  const { familyId } = requireParent(c);

  const family = (await getFamily(c.env.DB, familyId)) as { timezone?: string } | null;
  const timezone = family?.timezone ?? "Europe/Amsterdam";
  const from = localDate(timezone, new Date(Date.now() - PERIOD_DAYS * 24 * 3600 * 1000));

  const [totals, weekly, attention] = await Promise.all([
    childTotals(c.env.DB, familyId),
    weeklyEarned(c.env.DB, familyId, `-${PERIOD_DAYS} days`),
    tasksNeedingAttention(c.env.DB, familyId, from),
  ]);

  const weeklyByChild = new Map<string, Array<{ week: string; earned: number }>>();
  for (const row of weekly) {
    const list = weeklyByChild.get(row.child_id) ?? [];
    list.push({ week: row.week, earned: row.earned });
    weeklyByChild.set(row.child_id, list);
  }

  return c.json({
    from,
    children: totals.map((t) => ({
      childId: t.child_id,
      displayName: t.display_name,
      earned: t.earned,
      spent: t.spent,
      balance: t.balance,
      weekly: weeklyByChild.get(t.child_id) ?? [],
    })),
    tasksNeedingAttention: attention.map((a) => ({
      taskId: a.task_id,
      title: a.title,
      total: a.total,
      done: a.done,
      open: a.open,
      completionRate: a.total > 0 ? Math.round((a.done / a.total) * 100) / 100 : 0,
    })),
  });
});

export default insights;
