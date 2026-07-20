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
});
export type Balance = z.infer<typeof Balance>;
