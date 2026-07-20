import { z } from "zod";

/** Eén badge in de catalogus, met de verdien-status voor een specifiek kind. */
export const BadgeView = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  earned: z.boolean(),
  earnedAt: z.string().nullable(),
});
export type BadgeView = z.infer<typeof BadgeView>;

/** Antwoord van `GET /badges` (API-spec §3.9): hele catalogus + verdien-status. */
export const BadgesResponse = z.object({
  childId: z.string(),
  badges: z.array(BadgeView),
});
export type BadgesResponse = z.infer<typeof BadgesResponse>;
