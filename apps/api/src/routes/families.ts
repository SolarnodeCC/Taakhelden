import { Hono } from "hono";
import { FamilyPatchBody, InviteParentBody, ErrorCodes } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { newFamilyCode, newId, newToken } from "../services/ids";
import { getFamily, updateFamilySettings, setInviteCode, createPendingParent } from "../repo/families";
import { emailInUse } from "../repo/auth";

/** Uitnodiging blijft 7 dagen geldig (tot de tweede ouder een wachtwoord zet). */
const PARENT_INVITE_TTL = 7 * 24 * 3600;

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

/**
 * Tweede verzorger uitnodigen per e-mail. Maakt een pending parent-profiel en
 * een uitnodigingstoken (7 dagen in KV). De e-maillevering + accept-flow
 * (wachtwoord zetten) volgt zodra de mail-infra er is; het token wordt nu
 * teruggegeven zodat de uitnodiging gedeeld kan worden.
 */
families.post("/me/parents", validate("json", InviteParentBody), async (c) => {
  const { familyId } = requireParent(c, { full: true });
  const body = c.req.valid("json");

  if (await emailInUse(c.env.DB, body.email)) {
    throw new ApiException(409, ErrorCodes.EMAIL_IN_USE, "Dit e-mailadres is al in gebruik.");
  }

  const userId = newId("usr");
  await createPendingParent(c.env.DB, familyId, {
    id: userId,
    email: body.email,
    permissions: body.permissions,
  });

  const inviteToken = newToken();
  await c.env.KV.put(
    `parentinvite:${inviteToken}`,
    JSON.stringify({ familyId, userId }),
    { expirationTtl: PARENT_INVITE_TTL },
  );

  return c.json({ userId, email: body.email, permissions: body.permissions, inviteToken }, 201);
});

export default families;
