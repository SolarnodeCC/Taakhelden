import { z } from "zod";

export const TaskCategory = z.enum(["household", "homework", "selfcare", "custom"]);
export const Daypart = z.enum(["morning", "afternoon", "evening"]);

export const Recurrence = z.object({
  freq: z.enum(["daily", "weekly"]),
  days: z.array(z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"])).optional(),
});

export const TaskBody = z.object({
  title: z.string().min(1).max(80),
  category: TaskCategory.default("household"),
  icon: z.string().default("star"),
  points: z.number().int().min(1).max(500),
  photoBonusPoints: z.number().int().min(0).max(100).default(0),
  approvalRequired: z.boolean().default(false),
  assignees: z.array(z.string()).min(1),
  rotation: z.array(z.string()).min(2).optional(),
  recurrence: Recurrence.nullable().default(null),
  daypart: Daypart.nullable().default(null),
  activeFrom: z.string().date().optional(),
  activeUntil: z.string().date().nullable().default(null),
});
export type TaskBody = z.infer<typeof TaskBody>;

/** PATCH /tasks/{id} — werkt alleen door op toekomstige instances. */
export const TaskPatchBody = TaskBody.partial();
export type TaskPatchBody = z.infer<typeof TaskPatchBody>;
