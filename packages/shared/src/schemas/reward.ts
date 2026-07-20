import { z } from "zod";

export const RewardBody = z.object({
  title: z.string().min(1).max(60),
  icon: z.string().default("gift"),
  price: z.number().int().min(1).max(10000),
  limitPerWeek: z.number().int().min(1).nullable().default(null),
});
