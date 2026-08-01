import { z } from "zod";

export const ChildPause = z.object({
  id: z.string(),
  childId: z.string(),
  startsOn: z.string(),
  endsOn: z.string().nullable(),
  reason: z.string().max(140).nullable(),
  active: z.boolean(),
});
export type ChildPause = z.infer<typeof ChildPause>;

/** GET /members/:id/pause — list of pauses (active + upcoming); pick `.active`. */
export const ChildPauseResponse = z.object({
  pauses: z.array(ChildPause),
});
export type ChildPauseResponse = z.infer<typeof ChildPauseResponse>;

export const SetChildPauseBody = z.object({
  startsOn: z.string().date(),
  endsOn: z.string().date().nullable().optional(),
  reason: z.string().max(140).optional(),
});
export type SetChildPauseBody = z.infer<typeof SetChildPauseBody>;
