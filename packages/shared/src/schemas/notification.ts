import { z } from "zod";

const TimeOfDay = z.string().regex(/^\d{2}:\d{2}$/);

/** Notificatie-instellingen per kind (API-spec §3.10). Ouder beheert. */
export const NotificationSetting = z.object({
  childId: z.string(),
  enabled: z.boolean(),
  // null = neem het gezinsvenster (quietStart/quietEnd) over.
  quietStart: TimeOfDay.nullable(),
  quietEnd: TimeOfDay.nullable(),
});
export type NotificationSetting = z.infer<typeof NotificationSetting>;

export const NotificationSettingsResponse = z.object({
  settings: z.array(NotificationSetting),
});
export type NotificationSettingsResponse = z.infer<typeof NotificationSettingsResponse>;

/** PATCH /notification-settings — één kind bijwerken; velden optioneel. */
export const NotificationSettingsPatch = z.object({
  childId: z.string(),
  enabled: z.boolean().optional(),
  quietStart: TimeOfDay.nullable().optional(),
  quietEnd: TimeOfDay.nullable().optional(),
});
export type NotificationSettingsPatch = z.infer<typeof NotificationSettingsPatch>;
