import { z } from "zod";

/**
 * Ouder-inzichten (read-only): verdiend vs. uitgegeven per kind, een weektrend,
 * en taken die structureel blijven liggen. Alles afgeleid uit het ledger en de
 * task-instances — geen nieuwe schrijfpaden. Bedoeld als gespreksstof, niet als
 * surveillance (zie productvoorstel §3.7).
 */
export const WeeklyEarned = z.object({
  week: z.string(), // ISO jaar-week, bijv. "2026-29"
  earned: z.number().int(),
});
export type WeeklyEarned = z.infer<typeof WeeklyEarned>;

export const ChildInsights = z.object({
  childId: z.string(),
  displayName: z.string(),
  earned: z.number().int(),
  spent: z.number().int(),
  balance: z.number().int(),
  weekly: z.array(WeeklyEarned),
});
export type ChildInsights = z.infer<typeof ChildInsights>;

export const TaskAttention = z.object({
  taskId: z.string(),
  title: z.string(),
  total: z.number().int(),
  done: z.number().int(),
  open: z.number().int(),
  completionRate: z.number(), // 0..1
});
export type TaskAttention = z.infer<typeof TaskAttention>;

export const InsightsView = z.object({
  from: z.string(), // begindatum van de periode (YYYY-MM-DD)
  children: z.array(ChildInsights),
  tasksNeedingAttention: z.array(TaskAttention),
});
export type InsightsView = z.infer<typeof InsightsView>;
