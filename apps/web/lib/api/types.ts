import { z } from "zod";

/**
 * Web-side view schemas for the read endpoints the shell consumes. The API
 * defines these response shapes inline (they are not exported from
 * @taakhelden/shared), so we mirror the fields we render here and parse for
 * runtime safety. `.passthrough()` keeps unknown fields we don't use yet.
 */

export const FamilyView = z
  .object({
    id: z.string(),
    name: z.string(),
    timezone: z.string().optional(),
  })
  .passthrough();
export type FamilyView = z.infer<typeof FamilyView>;

export const MemberView = z
  .object({
    id: z.string(),
    role: z.enum(["parent", "child"]),
    displayName: z.string(),
    avatarId: z.string().nullable().optional(),
    permissions: z.enum(["full", "approve_only"]).optional(),
  })
  .passthrough();
export type MemberView = z.infer<typeof MemberView>;

export const MemberList = z.array(MemberView);

export const SessionInfo = z.object({
  userId: z.string(),
  familyId: z.string(),
  role: z.enum(["parent", "child"]),
  permissions: z.enum(["full", "approve_only"]),
});
export type SessionInfo = z.infer<typeof SessionInfo>;

// Mirrors the API's inline instanceView (apps/api/src/routes/instances.ts).
export const InstanceStatus = z.enum([
  "open",
  "completed",
  "submitted",
  "open_redo",
  "approved",
]);
export type InstanceStatus = z.infer<typeof InstanceStatus>;

export const InstanceView = z
  .object({
    id: z.string(),
    taskId: z.string(),
    childId: z.string(),
    status: InstanceStatus,
    title: z.string(),
    icon: z.string().nullable().optional(),
    points: z.number().nullable().optional(),
    photoBonusPoints: z.number().nullable().optional(),
    approvalRequired: z.boolean().optional(),
    daypart: z.string().nullable().optional(),
    photoId: z.string().nullable().optional(),
    pointsEarned: z.number().nullable().optional(),
    redoNote: z.string().nullable().optional(),
  })
  .passthrough();
export type InstanceView = z.infer<typeof InstanceView>;

// Parent shape of GET /instances/today: children grouped, each with a balance.
export const ChildToday = z.object({
  childId: z.string(),
  displayName: z.string(),
  avatarId: z.string().nullable().optional(),
  instances: z.array(InstanceView),
  balance: z.number(),
});
export type ChildToday = z.infer<typeof ChildToday>;

export const ParentTodayView = z.object({
  date: z.string(),
  children: z.array(ChildToday),
});
export type ParentTodayView = z.infer<typeof ParentTodayView>;

// GET /photos/{id}: signed, short-lived URL (null until the EXIF strip is done).
export const PhotoView = z.object({
  photoId: z.string(),
  status: z.enum(["intent", "uploaded", "processing", "ready", "failed"]),
  url: z.string().nullable(),
});
export type PhotoView = z.infer<typeof PhotoView>;

// --- Task management (Taken) — mirrors apps/api taskView + TaskBody. ---
export const TaskCategory = z.enum(["household", "homework", "selfcare", "custom"]);
export type TaskCategory = z.infer<typeof TaskCategory>;

export const Daypart = z.enum(["morning", "afternoon", "evening"]);
export type Daypart = z.infer<typeof Daypart>;

export const Weekday = z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);
export type Weekday = z.infer<typeof Weekday>;

export const Recurrence = z.object({
  freq: z.enum(["daily", "weekly"]),
  days: z.array(Weekday).optional(),
});
export type Recurrence = z.infer<typeof Recurrence>;

export const TaskView = z
  .object({
    id: z.string(),
    title: z.string(),
    category: TaskCategory,
    icon: z.string().nullable().optional(),
    points: z.number(),
    photoBonusPoints: z.number(),
    approvalRequired: z.boolean(),
    assignees: z.array(z.string()),
    rotation: z.array(z.string()).nullable().optional(),
    recurrence: Recurrence.nullable().optional(),
    daypart: Daypart.nullable().optional(),
    activeFrom: z.string().nullable().optional(),
    activeUntil: z.string().nullable().optional(),
  })
  .passthrough();
export type TaskView = z.infer<typeof TaskView>;

export const TaskList = z.array(TaskView);

// The payload the Taken form sends to POST/PATCH /tasks. Server applies the same
// defaults, so PATCH can carry a subset; here we always send the full form.
export interface TaskFormPayload {
  title: string;
  category: TaskCategory;
  icon: string;
  points: number;
  photoBonusPoints: number;
  approvalRequired: boolean;
  assignees: string[];
  recurrence: Recurrence | null;
  daypart: Daypart | null;
}
