import { z } from "zod";

/** Pushtoken-registratie; op een gedeelde iPad mag hetzelfde token aan
 *  meerdere profielen hangen (userId optioneel; default de ingelogde). */
export const DeviceBody = z.object({
  apnsToken: z.string().min(16).max(200),
  platform: z.enum(["ios"]).default("ios"),
  userId: z.string().optional(),
});
export type DeviceBody = z.infer<typeof DeviceBody>;
