import { z } from "zod";

export const RewardBody = z.object({
  title: z.string().min(1).max(60),
  icon: z.string().default("gift"),
  price: z.number().int().min(1).max(10000),
  limitPerWeek: z.number().int().min(1).nullable().default(null),
});

export const RewardPatchBody = z.object({
  title: z.string().min(1).max(60).optional(),
  icon: z.string().optional(),
  price: z.number().int().min(1).max(10000).optional(),
  limitPerWeek: z.number().int().min(1).nullable().optional(),
});
export type RewardPatchBody = z.infer<typeof RewardPatchBody>;

export const RedemptionStatus = z.enum(["pending", "fulfilled", "cancelled"]);

/** Response van POST /rewards/{id}/redeem */
export const RedeemResult = z.object({
  redemptionId: z.string(),
  rewardId: z.string(),
  price: z.number().int(),
  status: z.literal("pending"),
  newBalance: z.number().int(),
});
export type RedeemResult = z.infer<typeof RedeemResult>;
