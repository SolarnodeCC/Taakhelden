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

export const RewardView = z.object({
  id: z.string(),
  title: z.string(),
  icon: z.string().nullable(),
  price: z.number().int(),
  limitPerWeek: z.number().int().nullable(),
});
export type RewardView = z.infer<typeof RewardView>;

export const ChildRewardView = RewardView.extend({
  affordable: z.boolean(),
  pinned: z.boolean(),
});
export type ChildRewardView = z.infer<typeof ChildRewardView>;

export const SavingsGoalView = z.object({
  rewardId: z.string(),
  title: z.string(),
  icon: z.string().nullable(),
  price: z.number().int(),
  progress: z.number().min(0).max(1),
});
export type SavingsGoalView = z.infer<typeof SavingsGoalView>;

export const ParentRewardsView = z.object({
  viewer: z.literal("parent"),
  rewards: z.array(RewardView),
});
export type ParentRewardsView = z.infer<typeof ParentRewardsView>;

export const ChildRewardsView = z.object({
  viewer: z.literal("child"),
  balance: z.number().int(),
  rewards: z.array(ChildRewardView),
  savingsGoal: SavingsGoalView.nullable(),
});
export type ChildRewardsView = z.infer<typeof ChildRewardsView>;

export const RewardsViewerResponse = z.discriminatedUnion("viewer", [
  ParentRewardsView,
  ChildRewardsView,
]);
export type RewardsViewerResponse = z.infer<typeof RewardsViewerResponse>;

export const RedemptionStatus = z.enum(["pending", "fulfilled", "cancelled"]);

export const RedemptionView = z.object({
  id: z.string(),
  rewardId: z.string(),
  title: z.string(),
  icon: z.string().nullable(),
  price: z.number().int(),
  childId: z.string(),
  status: RedemptionStatus,
  createdAt: z.string(),
  handledAt: z.string().nullable(),
});
export type RedemptionView = z.infer<typeof RedemptionView>;

export const ParentRedemptionsView = z.object({
  viewer: z.literal("parent"),
  redemptions: z.array(RedemptionView),
});
export type ParentRedemptionsView = z.infer<typeof ParentRedemptionsView>;

export const ChildRedemptionsView = z.object({
  viewer: z.literal("child"),
  redemptions: z.array(RedemptionView),
});
export type ChildRedemptionsView = z.infer<typeof ChildRedemptionsView>;

export const RedemptionsViewerResponse = z.discriminatedUnion("viewer", [
  ParentRedemptionsView,
  ChildRedemptionsView,
]);
export type RedemptionsViewerResponse = z.infer<typeof RedemptionsViewerResponse>;

/** Response van POST /rewards/{id}/redeem */
export const RedeemResult = z.object({
  redemptionId: z.string(),
  rewardId: z.string(),
  price: z.number().int(),
  status: z.literal("pending"),
  newBalance: z.number().int(),
});
export type RedeemResult = z.infer<typeof RedeemResult>;
