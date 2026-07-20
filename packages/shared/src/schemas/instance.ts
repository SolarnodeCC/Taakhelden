import { z } from "zod";

export const InstanceStatus = z.enum([
  "open", "completed", "submitted", "open_redo", "approved",
]);

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
