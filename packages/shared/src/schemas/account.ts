import { z } from "zod";

/**
 * `DELETE /account` verwijdert het hele gezin (7 dagen soft delete → cascade).
 * Wachtwoord her-invoer is verplicht als bevestiging (API-spec §3.12).
 */
export const AccountDeleteBody = z.object({
  password: z.string().min(1, "Bevestig met je wachtwoord."),
});
export type AccountDeleteBody = z.infer<typeof AccountDeleteBody>;
