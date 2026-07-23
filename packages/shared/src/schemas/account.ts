import { z } from "zod";

/**
 * `DELETE /account` verwijdert het hele gezin (7 dagen soft delete → cascade).
 * Wachtwoord her-invoer is verplicht als bevestiging (API-spec §3.12).
 */
export const AccountDeleteBody = z.object({
  password: z.string().min(1, "Bevestig met je wachtwoord."),
});
export type AccountDeleteBody = z.infer<typeof AccountDeleteBody>;

/**
 * Data-export (AVG art. 20) loopt asynchroon: `POST /account/export` start een
 * job, `GET /account/export/{id}` geeft de status en — zodra klaar — een
 * kortlevende downloadlink naar het ZIP-bestand (JSON + foto's).
 */
export const ExportStatus = z.enum(["pending", "ready", "failed"]);
export type ExportStatus = z.infer<typeof ExportStatus>;

export const ExportJobView = z.object({
  exportId: z.string(),
  status: ExportStatus,
  downloadUrl: z.string().optional(),
});
export type ExportJobView = z.infer<typeof ExportJobView>;
