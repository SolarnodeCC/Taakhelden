import { z } from "zod";

export const LedgerType = z.enum([
  "task", "photo_bonus", "day_bonus", "week_bonus",
  "redemption", "redemption_cancel", "adjustment", "badge",
]);

export const AdjustBody = z.object({
  childId: z.string(),
  amount: z.number().int().min(1).max(1000), // alleen positief — architectuurregel
  note: z.string().min(1).max(200),
});

export const Balance = z.object({
  childId: z.string(),
  balance: z.number().int(),
  todayCompleted: z.number().int(),
  todayTotal: z.number().int(),
  weekProgress: z.number(),      // 0..1 richting weekbonus
  streakDays: z.number().int(),
  lifetimeEarned: z.number().int().nonnegative(),
});
export type Balance = z.infer<typeof Balance>;

export const ChildBalanceView = Balance.extend({
  viewer: z.literal("child"),
});
export type ChildBalanceView = z.infer<typeof ChildBalanceView>;

export const ParentBalancesView = z.object({
  viewer: z.literal("parent"),
  children: z.array(Balance),
});
export type ParentBalancesView = z.infer<typeof ParentBalancesView>;

export const BalanceViewerResponse = z.discriminatedUnion("viewer", [
  ChildBalanceView,
  ParentBalancesView,
]);
export type BalanceViewerResponse = z.infer<typeof BalanceViewerResponse>;
