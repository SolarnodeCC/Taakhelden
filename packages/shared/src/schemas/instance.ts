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
  photoStatus: z.enum(["processing", "ready"]).nullable(),
  pointsEarned: z.number().int().nullable(),
  redoNote: z.string().nullable(),
  completedAt: z.string().nullable(),
  approvedAt: z.string().nullable(),
  /**
   * Servertijd (ISO-8601 UTC) van de laatste wijziging — de sleutel voor de
   * sync-delta (`since`). Optioneel voor achterwaartse compatibiliteit met
   * clients van vóór migratie 0007.
   */
  updatedAt: z.string().optional(),
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
  lifetimeEarned: z.number().int().nonnegative(),
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

export const ViewerChildTodayView = ChildTodayView.extend({
  viewer: z.literal("child"),
});
export type ViewerChildTodayView = z.infer<typeof ViewerChildTodayView>;

export const ViewerParentTodayView = ParentTodayView.extend({
  viewer: z.literal("parent"),
});
export type ViewerParentTodayView = z.infer<typeof ViewerParentTodayView>;

export const TodayViewerResponse = z.discriminatedUnion("viewer", [
  ViewerChildTodayView,
  ViewerParentTodayView,
]);
export type TodayViewerResponse = z.infer<typeof TodayViewerResponse>;

/** Opaque pagination cursor for GET /instances (history). */
export const HistoryCursor = z.object({
  date: z.string(),
  id: z.string(),
});
export type HistoryCursor = z.infer<typeof HistoryCursor>;

export const RedoBody = z.object({
  note: z.string().min(1).max(200), // vriendelijke toelichting, verplicht
});

export const AttachPhotoBody = z.object({
  photoId: z.string(),
});

/** Body voor POST /instances/{id}/move — volledig doelslot (datum + kind). */
export const MoveInstanceBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  childId: z.string().min(1),
});
export type MoveInstanceBody = z.infer<typeof MoveInstanceBody>;

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
