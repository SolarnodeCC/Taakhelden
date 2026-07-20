/**
 * GET/PATCH /notification-settings (API-spec §3.10) — per kind aan/uit +
 * tijdvenster. De ouder beheert; het kind heeft hier geen toegang.
 */
import { Hono } from "hono";
import { NotificationSettingsPatch, ErrorCodes, type NotificationSetting } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { listSettings, getSetting, upsertSetting, type NotificationSettingRow } from "../repo/notifications";

const notifications = new Hono<AppBindings>();

function view(row: NotificationSettingRow): NotificationSetting {
  return {
    childId: row.child_id,
    enabled: Boolean(row.enabled),
    quietStart: row.quiet_start,
    quietEnd: row.quiet_end,
  };
}

notifications.get("/", async (c) => {
  const { familyId } = requireParent(c);
  const rows = await listSettings(c.env.DB, familyId);
  return c.json({ settings: rows.map(view) });
});

notifications.patch("/", validate("json", NotificationSettingsPatch), async (c) => {
  const { familyId } = requireParent(c, { full: true });
  const body = c.req.valid("json");

  const current = await getSetting(c.env.DB, familyId, body.childId);
  if (!current) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Kindprofiel niet gevonden.");
  }

  const merged = {
    enabled: body.enabled ?? Boolean(current.enabled),
    quietStart: body.quietStart !== undefined ? body.quietStart : current.quiet_start,
    quietEnd: body.quietEnd !== undefined ? body.quietEnd : current.quiet_end,
  };
  await upsertSetting(c.env.DB, body.childId, merged);

  return c.json(
    view({
      child_id: body.childId,
      enabled: merged.enabled ? 1 : 0,
      quiet_start: merged.quietStart,
      quiet_end: merged.quietEnd,
    }),
  );
});

export default notifications;
