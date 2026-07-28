import { z } from "zod";

export const InstanceStatus = z.enum([
  "open", "completed", "submitted", "open_redo", "approved",
]);

/** Task-instance read model returned by GET /instances/today. */
export const InstanceView = z.object({
  id: z.string(),
  taskId: z.string(),
  childId: z.string(),
  date: z.string(),
  status: InstanceStatus,
  title: z.string(),
  icon: z.string().nullable(),
  category: z.string(),
  points: z.number().int(),
  photoBonusPoints: z.number().int(),
  approvalRequired: z.boolean(),
  daypart: z.string().nullable(),
  photoId: z.string().nullable(),
  pointsEarned: z.number().int().nullable(),
  redoNote: z.string().nullable(),
  completedAt: z.string().nullable(),
  approvedAt: z.string().nullable(),
});
export type InstanceView = z.infer<typeof InstanceView>;

/** Ledger-derived progress returned alongside today's task instances. */
export const TodayBalance = z.object({
  childId: z.string(),
  balance: z.number().int(),
  todayCompleted: z.number().int().nonnegative(),
  todayTotal: z.number().int().nonnegative(),
  weekProgress: z.number().min(0).max(1),
  streakDays: z.number().int().nonnegative(),
});
export type TodayBalance = z.infer<typeof TodayBalance>;

/** Child response from GET /instances/today. */
export const ChildTodayView = z.object({
  date: z.string(),
  instances: z.array(InstanceView),
  balance: TodayBalance,
});
export type ChildTodayView = z.infer<typeof ChildTodayView>;

/** One child in the grouped parent response from GET /instances/today. */
export const ChildToday = z.object({
  childId: z.string(),
  displayName: z.string(),
  avatarId: z.string().nullable(),
  instances: z.array(InstanceView),
  balance: TodayBalance,
});
export type ChildToday = z.infer<typeof ChildToday>;

export const ParentTodayView = z.object({
  date: z.string(),
  children: z.array(ChildToday),
});
export type ParentTodayView = z.infer<typeof ParentTodayView>;

export const RedoBody = z.object({
  note: z.string().min(1).max(200), // vriendelijke toelichting, verplicht
});

export const AttachPhotoBody = z.object({
  photoId: z.string(),
});

/** Response van POST /instances/{id}/complete — alles voor confetti in één roundtrip */
export const CompleteResult = z.object({
  pointsEarned: z.number().int(),
  photoBonusPoints: z.number().int(),
  dayBonusEarned: z.boolean(),
  weekBonusEarned: z.boolean(),
  newBadges: z.array(z.object({ id: z.string(), title: z.string(), icon: z.string() })),
  newBalance: z.number().int(),
});
export type CompleteResult = z.infer<typeof CompleteResult>;
