import { z } from "zod";

/** Pushtoken-registratie; op een gedeelde iPad mag hetzelfde token aan
 *  meerdere profielen hangen (userId optioneel; default de ingelogde).
 *
 *  `apnsToken` heet historisch naar APNs, maar draagt sinds de Android-client ook
 *  het FCM-registratietoken. `platform` bepaalt via welke gateway we versturen. */
export const DeviceBody = z.object({
  apnsToken: z.string().min(16).max(200),
  platform: z.enum(["ios", "android"]).default("ios"),
  userId: z.string().optional(),
});
export type DeviceBody = z.infer<typeof DeviceBody>;

export const DeviceOkResponse = z.object({
  ok: z.literal(true),
});
export type DeviceOkResponse = z.infer<typeof DeviceOkResponse>;
