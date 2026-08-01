import { z } from "zod";

export const InsightsRange = z.enum(["week"]);
export type InsightsRange = z.infer<typeof InsightsRange>;

export const SlippingTask = z.object({
  taskId: z.string(),
  title: z.string(),
  icon: z.string(),
  missed: z.number().int().positive(),
});
export type SlippingTask = z.infer<typeof SlippingTask>;

export const ChildInsights = z.object({
  childId: z.string(),
  displayName: z.string(),
  earned: z.number().int().nonnegative(),
  spent: z.number().int().nonnegative(),
  net: z.number().int(),
  tasksApproved: z.number().int().nonnegative(),
  tasksTotal: z.number().int().nonnegative(),
  completionRate: z.number().min(0).max(1),
  streakDays: z.number().int().nonnegative(),
  slippingTasks: z.array(SlippingTask).max(5),
});
export type ChildInsights = z.infer<typeof ChildInsights>;

export const WeeklyInsightsResponse = z.object({
  weekOf: z.string(),
  range: InsightsRange,
  children: z.array(ChildInsights),
});
export type WeeklyInsightsResponse = z.infer<typeof WeeklyInsightsResponse>;

export const InsightsQuery = z.object({
  range: InsightsRange.default("week"),
  weekOf: z.string().date().optional(),
  childId: z.string().optional(),
});
export type InsightsQuery = z.infer<typeof InsightsQuery>;
