import { z } from "zod";

export const FamilyGoalStatus = z.enum(["active", "completed", "archived"]);
export type FamilyGoalStatus = z.infer<typeof FamilyGoalStatus>;

export const FamilyGoal = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(80),
  icon: z.string().min(1).max(8),
  targetPoints: z.number().int().min(1).max(100_000),
  childIds: z.array(z.string()).default([]),
  startedAt: z.string().min(1),
  completedAt: z.string().nullable(),
  status: FamilyGoalStatus,
});
export type FamilyGoal = z.infer<typeof FamilyGoal>;

export const CreateFamilyGoalBody = z.object({
  title: z.string().min(1).max(80),
  icon: z.string().min(1).max(8).default("🎯"),
  targetPoints: z.number().int().min(1).max(100_000),
  childIds: z.array(z.string()).max(20).default([]),
});
export type CreateFamilyGoalBody = z.infer<typeof CreateFamilyGoalBody>;

export const PatchFamilyGoalBody = z.object({
  status: z.enum(["archived", "completed"]).optional(),
  title: z.string().min(1).max(80).optional(),
  icon: z.string().min(1).max(8).optional(),
});
export type PatchFamilyGoalBody = z.infer<typeof PatchFamilyGoalBody>;

export const FamilyGoalsResponse = z.object({
  goals: z.array(FamilyGoal),
});
export type FamilyGoalsResponse = z.infer<typeof FamilyGoalsResponse>;

export const FamilyGoalProgress = z.object({
  goalId: z.string(),
  title: z.string(),
  icon: z.string(),
  earnedPoints: z.number().int().nonnegative(),
  targetPoints: z.number().int().positive(),
  status: FamilyGoalStatus,
});
export type FamilyGoalProgress = z.infer<typeof FamilyGoalProgress>;

export const FamilyGoalProgressResponse = z.object({
  progress: FamilyGoalProgress.nullable(),
});
export type FamilyGoalProgressResponse = z.infer<typeof FamilyGoalProgressResponse>;
