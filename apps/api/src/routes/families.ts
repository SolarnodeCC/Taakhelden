import { Hono } from "hono";
import { FamilyPatchBody, ErrorCodes } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { newFamilyCode } from "../services/ids";
import { getFamily, updateFamilySettings, setInviteCode } from "../repo/families";

const families = new Hono<AppBindings>();

function familyView(family: Record<string, unknown>, role: "parent" | "child") {
  const base = {
    id: family.id,
    name: family.name,
    timezone: family.timezone,
  };
  if (role === "child") return base; // uitgekleed: geen code, geen instellingen
  return {
    ...base,
    inviteCode: family.invite_code,
    quietStart: family.quiet_start,
    quietEnd: family.quiet_end,
    dayBonusPoints: family.day_bonus_points,
    weekBonusPoints: family.week_bonus_points,
    weekBonusThreshold: family.week_bonus_threshold,
    vacationMode: Boolean(family.vacation_mode),
  };
}

families.get("/me", async (c) => {
  const { familyId, role } = c.get("auth");
  const family = await getFamily(c.env.DB, familyId);
  if (!family) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Gezin niet gevonden.");
  }
  return c.json(familyView(family as Record<string, unknown>, role));
});

families.patch("/me", validate("json", FamilyPatchBody), async (c) => {
  const { familyId } = requireParent(c, { full: true });
  await updateFamilySettings(c.env.DB, familyId, c.req.valid("json"));
  const family = await getFamily(c.env.DB, familyId);
  return c.json(familyView(family as Record<string, unknown>, "parent"));
});

/** (Her)genereer de gezinscode — de oude vervalt direct. */
families.post("/me/invite-code", async (c) => {
  const { familyId } = requireParent(c, { full: true });
  const code = newFamilyCode();
  await setInviteCode(c.env.DB, familyId, code);
  return c.json({ inviteCode: code });
});

// TODO(iteratie 2): POST /me/parents — tweede verzorger uitnodigen per e-mail.
families.post("/me/parents", async (c) => {
  requireParent(c, { full: true });
  return c.json({ todo: "parent invite per e-mail" }, 501);
});

export default families;
