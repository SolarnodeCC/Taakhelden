import { Hono } from "hono";
import { FamilyPatchBody, InviteParentBody, ParentAcceptBody, ErrorCodes } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { newFamilyCode, newId, newToken } from "../services/ids";
import { hashSecret } from "../services/passwords";
import { issueParentTokens } from "../services/session";
import { sendParentInvite } from "../services/email";
import {
  getFamily,
  updateFamilySettings,
  setInviteCode,
  createPendingParent,
  activatePendingParent,
} from "../repo/families";
import { emailInUse, getUserById } from "../repo/auth";

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
 * een uitnodigingstoken (7 dagen in KV) en verstuurt de uitnodigingsmail
 * (env-guarded no-op zonder mail-secrets). Het token wordt ook teruggegeven zodat
 * de uitnodiging desnoods handmatig gedeeld kan worden.
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
  await sendParentInvite(c.env, body.email, inviteToken);

  return c.json({ userId, email: body.email, permissions: body.permissions, inviteToken }, 201);
});

export default families;

/**
 * Publieke accept-flow: de uitgenodigde verzorger zet met het token uit de mail
 * een eigen wachtwoord. Vóór de auth-middleware gemount (nog niet ingelogd).
 * Het token is eenmalig; dubbel-accepteren wordt atomair afgevangen.
 */
export const parentAccept = new Hono<AppBindings>();

parentAccept.post("/parents/accept", validate("json", ParentAcceptBody), async (c) => {
  const { token, password, displayName } = c.req.valid("json");

  const raw = await c.env.KV.get(`parentinvite:${token}`);
  if (!raw) {
    throw new ApiException(400, ErrorCodes.INVALID_INVITE, "Deze uitnodiging is ongeldig of verlopen.");
  }
  const { familyId, userId } = JSON.parse(raw) as { familyId: string; userId: string };

  const activated = await activatePendingParent(c.env.DB, familyId, userId, {
    passwordHash: await hashSecret(password),
    displayName,
  });
  await c.env.KV.delete(`parentinvite:${token}`); // eenmalig — hoe dan ook opruimen
  if (!activated) {
    throw new ApiException(409, ErrorCodes.INVALID_INVITE, "Deze uitnodiging is niet meer geldig.");
  }

  const user = await getUserById(c.env.DB, userId);
  const tokens = await issueParentTokens(c.env.DB, c.env.JWT_SECRET, {
    id: userId,
    family_id: familyId,
    permissions: (user?.permissions as string) ?? "approve_only",
  });
  return c.json({ familyId, userId, ...tokens });
});
