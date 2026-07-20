import { Hono } from "hono";
import { DeviceBody, ErrorCodes } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { registerDevice, deleteDeviceToken } from "../repo/devices";
import { getMember } from "../repo/families";

const devices = new Hono<AppBindings>();

devices.post("/", validate("json", DeviceBody), async (c) => {
  const { familyId, userId } = c.get("auth");
  const body = c.req.valid("json");
  const target = body.userId ?? userId;
  if (target !== userId) {
    // Gedeelde iPad: een ouder mag het token ook aan andere profielen hangen.
    requireParent(c);
    const member = await getMember(c.env.DB, familyId, target);
    if (!member) {
      throw new ApiException(404, ErrorCodes.NOT_FOUND, "Gezinslid niet gevonden.");
    }
  }
  await registerDevice(c.env.DB, familyId, {
    userId: target,
    apnsToken: body.apnsToken,
    platform: body.platform,
  });
  return c.json({ ok: true }, 201);
});

/** Bij uitloggen: token loskoppelen van alle profielen binnen dit gezin. */
devices.delete("/:token", async (c) => {
  const { familyId } = c.get("auth");
  await deleteDeviceToken(c.env.DB, familyId, c.req.param("token"));
  return c.json({ ok: true });
});

// TODO(iteratie 3): GET/PATCH /notification-settings — per kind aan/uit + tijdvensters.

export default devices;
