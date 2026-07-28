import { z } from "zod";
import { InstanceView } from "@taakhelden/shared";
export {
  ChildToday,
  ChildTodayView,
  InstanceStatus,
  InstanceView,
  ParentTodayView,
  TodayBalance,
} from "@taakhelden/shared";

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
    inviteCode: z.string().length(6).optional(),
    quietStart: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    quietEnd: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    dayBonusPoints: z.number().int().min(0).optional(),
    weekBonusPoints: z.number().int().min(0).optional(),
    weekBonusThreshold: z.number().min(0.5).max(1).optional(),
    vacationMode: z.boolean().optional(),
  })
  .passthrough();
export type FamilyView = z.infer<typeof FamilyView>;

export const InviteCodeResult = z.object({
  inviteCode: z.string().length(6),
});
export type InviteCodeResult = z.infer<typeof InviteCodeResult>;

/** POST /families/me/parents — pending co-parent + shareable invite token. */
export const InviteParentResult = z.object({
  userId: z.string(),
  email: z.string().email(),
  permissions: z.enum(["full", "approve_only"]),
  inviteToken: z.string().min(1),
});
export type InviteParentResult = z.infer<typeof InviteParentResult>;

export const AgeMode = z.enum(["young", "mid", "teen"]);
export type AgeMode = z.infer<typeof AgeMode>;

export const MemberView = z
  .object({
    id: z.string(),
    role: z.enum(["parent", "child"]),
    displayName: z.string(),
    avatarId: z.string().nullable().optional(),
    permissions: z.enum(["full", "approve_only"]).optional(),
    birthYear: z.number().int().nullable().optional(),
    ageMode: AgeMode.nullable().optional(),
    email: z.string().nullable().optional(),
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

/** Partial task fields returned by GET /tasks/templates. */
export const TaskTemplate = z
  .object({
    title: z.string(),
    category: TaskCategory.optional(),
    icon: z.string().optional(),
    points: z.number().optional(),
    photoBonusPoints: z.number().optional(),
    approvalRequired: z.boolean().optional(),
    recurrence: Recurrence.nullable().optional(),
    daypart: Daypart.nullable().optional(),
  })
  .passthrough();
export type TaskTemplate = z.infer<typeof TaskTemplate>;

export const TaskTemplatesResponse = z.object({
  age: z.number(),
  templates: z.array(TaskTemplate),
});
export type TaskTemplatesResponse = z.infer<typeof TaskTemplatesResponse>;

export const InstanceHistoryResponse = z.object({
  instances: z.array(InstanceView),
  nextCursor: z.string().nullable(),
});
export type InstanceHistoryResponse = z.infer<typeof InstanceHistoryResponse>;

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
  rotation?: string[];
  recurrence: Recurrence | null;
  daypart: Daypart | null;
  activeFrom?: string;
  activeUntil?: string | null;
}

/** Prefill for TaskForm from a template or partial task. */
export type TaskFormPrefill = Partial<
  Pick<
    TaskView,
    | "title"
    | "category"
    | "icon"
    | "points"
    | "photoBonusPoints"
    | "approvalRequired"
    | "assignees"
    | "recurrence"
    | "daypart"
    | "rotation"
    | "activeFrom"
    | "activeUntil"
  >
>;

// --- Winkel (rewards + redemptions) — mirrors apps/api rewardView + redemptions. ---
export const RewardView = z
  .object({
    id: z.string(),
    title: z.string(),
    icon: z.string().nullable().optional(),
    price: z.number(),
    limitPerWeek: z.number().nullable().optional(),
  })
  .passthrough();
export type RewardView = z.infer<typeof RewardView>;

export const RewardList = z.array(RewardView);

export interface RewardFormPayload {
  title: string;
  icon: string;
  price: number;
  limitPerWeek: number | null;
}

export const RedemptionStatus = z.enum(["pending", "fulfilled", "cancelled"]);
export type RedemptionStatus = z.infer<typeof RedemptionStatus>;

export const RedemptionView = z
  .object({
    id: z.string(),
    rewardId: z.string(),
    title: z.string(),
    icon: z.string().nullable().optional(),
    price: z.number(),
    childId: z.string(),
    status: RedemptionStatus,
    createdAt: z.string(),
    handledAt: z.string().nullable().optional(),
  })
  .passthrough();
export type RedemptionView = z.infer<typeof RedemptionView>;

export const RedemptionList = z.array(RedemptionView);
