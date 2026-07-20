import { z } from "zod";

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024; // spec §3.6
export const PHOTO_DAILY_LIMIT = 20; // uploads per kind per dag

export const PhotoContentType = z.enum(["image/jpeg", "image/heic", "image/png"]);

export const UploadIntentBody = z
  .object({
    purpose: z.enum(["task", "profile"]),
    instanceId: z.string().optional(), // verplicht bij purpose 'task'
    memberId: z.string().optional(), // verplicht bij purpose 'profile'
    contentType: PhotoContentType,
    bytes: z.number().int().min(1).max(PHOTO_MAX_BYTES),
  })
  .refine((b) => (b.purpose === "task" ? !!b.instanceId : !!b.memberId), {
    message: "instanceId (task) of memberId (profile) is verplicht",
  });
export type UploadIntentBody = z.infer<typeof UploadIntentBody>;

export const PhotoStatus = z.enum(["intent", "uploaded", "processing", "ready", "failed"]);
export type PhotoStatus = z.infer<typeof PhotoStatus>;
