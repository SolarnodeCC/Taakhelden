import { Hono } from "hono";
import {
  RegisterBody,
  LoginBody,
  AppleAuthBody,
  FamilyCodeBody,
  ChildSessionBody,
  RefreshBody,
  LogoutBody,
  ErrorCodes,
} from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { validate } from "../middleware/validate";
import { rateLimit } from "../middleware/ratelimit";
import { newId, newFamilyCode } from "../services/ids";
import { signJwt } from "../services/jwt";
import { issueParentTokens, ACCESS_TTL_CHILD } from "../services/session";
import { hashSecret, verifySecret } from "../services/passwords";
import { verifyTurnstile } from "../services/turnstile";
import { verifyAppleIdentityToken } from "../services/apple";
import { notifyParents, parentCopy } from "../services/notifier";
import * as repo from "../repo/auth";

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 15;

const auth = new Hono<AppBindings>();

type ParentRow = { id: string; family_id: string; permissions: string };

auth.post("/register", validate("json", RegisterBody), async (c) => {
  await rateLimit(c, "register", 5);
  const body = c.req.valid("json");

  const human = await verifyTurnstile(
    c.env.TURNSTILE_SECRET,
    body.turnstileToken,
    c.req.header("CF-Connecting-IP"),
  );
  if (!human) {
    throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Verificatie mislukt, probeer het opnieuw.");
  }
  if (await repo.getParentByEmail(c.env.DB, body.email)) {
    throw new ApiException(409, ErrorCodes.EMAIL_IN_USE, "Dit e-mailadres is al in gebruik.");
  }

  const familyId = newId("fam");
  const parentId = newId("usr");
  await repo.createFamilyWithParent(c.env.DB, {
    familyId,
    inviteCode: newFamilyCode(),
    familyName: body.familyName,
    parentId,
    email: body.email,
    passwordHash: await hashSecret(body.password),
    displayName: body.displayName,
  });

  const tokens = await issueParentTokens(c.env.DB, c.env.JWT_SECRET, {
    id: parentId,
    family_id: familyId,
    permissions: "full",
  });
  return c.json({ familyId, userId: parentId, ...tokens }, 201);
});

auth.post("/login", validate("json", LoginBody), async (c) => {
  await rateLimit(c, "login", 5);
  const body = c.req.valid("json");

  const user = await repo.getParentByEmail(c.env.DB, body.email);
  const ok =
    user?.password_hash && (await verifySecret(body.password, user.password_hash as string));
  if (!user || !ok) {
    throw new ApiException(401, ErrorCodes.INVALID_CREDENTIALS, "E-mail of wachtwoord klopt niet.");
  }
  const tokens = await issueParentTokens(c.env.DB, c.env.JWT_SECRET, user as unknown as ParentRow);
  return c.json({ familyId: user.family_id, userId: user.id, ...tokens });
});

/** Sign in with Apple: bestaand account (apple_sub of e-mail) of nieuw gezin. */
auth.post("/apple", validate("json", AppleAuthBody), async (c) => {
  await rateLimit(c, "apple", 5);
  const body = c.req.valid("json");

  const claims = await verifyAppleIdentityToken(body.identityToken, c.env.APPLE_CLIENT_ID);
  if (!claims) {
    throw new ApiException(
      401,
      ErrorCodes.INVALID_CREDENTIALS,
      "Inloggen met Apple is niet gelukt. Probeer het opnieuw.",
    );
  }

  let user = await repo.getParentByAppleSub(c.env.DB, claims.sub);
  if (!user && claims.email) {
    // Zelfde e-mailadres als een bestaand wachtwoord-account → koppelen.
    const byEmail = await repo.getParentByEmail(c.env.DB, claims.email);
    if (byEmail) {
      await repo.linkAppleSub(c.env.DB, byEmail.id as string, claims.sub);
      user = byEmail;
    }
  }
  let isNew = false;
  if (!user) {
    const familyId = newId("fam");
    const parentId = newId("usr");
    await repo.createFamilyWithParent(c.env.DB, {
      familyId,
      inviteCode: newFamilyCode(),
      familyName: body.familyName ?? "Ons gezin",
      parentId,
      email: claims.email,
      passwordHash: null,
      appleSub: claims.sub,
      displayName: body.displayName ?? "Ouder",
    });
    user = await repo.getUserById(c.env.DB, parentId);
    isNew = true;
  }

  const tokens = await issueParentTokens(c.env.DB, c.env.JWT_SECRET, user as unknown as ParentRow);
  return c.json(
    { familyId: (user as ParentRow).family_id, userId: (user as ParentRow).id, ...tokens },
    isNew ? 201 : 200,
  );
});

auth.post("/refresh", validate("json", RefreshBody), async (c) => {
  const consumed = await repo.consumeRefreshToken(c.env.DB, c.req.valid("json").refreshToken);
  const user = consumed && (await repo.getUserById(c.env.DB, consumed.user_id as string));
  if (!user) {
    throw new ApiException(401, ErrorCodes.UNAUTHORIZED, "Sessie verlopen, log opnieuw in.");
  }
  const tokens = await issueParentTokens(c.env.DB, c.env.JWT_SECRET, user as unknown as ParentRow);
  return c.json(tokens);
});

auth.post("/logout", validate("json", LogoutBody), async (c) => {
  await repo.revokeRefreshToken(c.env.DB, c.req.valid("json").refreshToken);
  return c.json({ ok: true });
});

/** Stap 1 kind-login: gezinscode → kindprofielen. Zwaar rate-limited, geen PII. */
auth.post("/family-code", validate("json", FamilyCodeBody), async (c) => {
  await rateLimit(c, "family-code", 10);
  const family = await repo.getFamilyByInviteCode(c.env.DB, c.req.valid("json").familyCode);
  if (!family) {
    throw new ApiException(
      404,
      ErrorCodes.INVALID_FAMILY_CODE,
      "Deze gezinscode kennen we niet. Kijk 'm nog eens goed na!",
    );
  }
  const children = await repo.listChildProfiles(c.env.DB, family.id as string);
  return c.json({ familyName: family.name, children });
});

/** Stap 2 kind-login: pincode → kind-JWT (24 u). 5 fouten → 15 min lock. */
auth.post("/child-session", validate("json", ChildSessionBody), async (c) => {
  await rateLimit(c, "child-session", 10);
  const body = c.req.valid("json");

  const family = await repo.getFamilyByInviteCode(c.env.DB, body.familyCode);
  const child = family && (await repo.getChildForLogin(c.env.DB, family.id as string, body.childId));
  if (!family || !child) {
    throw new ApiException(
      404,
      ErrorCodes.INVALID_FAMILY_CODE,
      "Deze gezinscode kennen we niet. Kijk 'm nog eens goed na!",
    );
  }

  const lockedUntil = child.pin_locked_until as string | null;
  if (lockedUntil && new Date(lockedUntil) > new Date()) {
    throw new ApiException(403, ErrorCodes.PIN_LOCKED, "Even pauze! Probeer het over een kwartiertje nog eens.");
  }

  const ok = child.pincode_hash && (await verifySecret(body.pincode, child.pincode_hash as string));
  if (!ok) {
    const attemptsKey = `pinfail:${child.id}`;
    const attempts = Number((await c.env.KV.get(attemptsKey)) ?? "0") + 1;
    await c.env.KV.put(attemptsKey, String(attempts), { expirationTtl: PIN_LOCK_MINUTES * 60 });
    if (attempts >= PIN_MAX_ATTEMPTS) {
      const until = new Date(Date.now() + PIN_LOCK_MINUTES * 60 * 1000).toISOString();
      await repo.setPinLock(c.env.DB, family.id as string, child.id as string, until);
      // Ouders informeren — buiten de response om, en een APNs-fout blokkeert niets.
      c.executionCtx.waitUntil(
        notifyParents(
          c.env,
          family.id as string,
          parentCopy.pinLock(child.display_name as string),
        ).catch(() => {}),
      );
      throw new ApiException(403, ErrorCodes.PIN_LOCKED, "Even pauze! Probeer het over een kwartiertje nog eens.");
    }
    throw new ApiException(
      401,
      ErrorCodes.INVALID_CREDENTIALS,
      "Die pincode klopt niet helemaal — probeer het nog eens!",
    );
  }

  await c.env.KV.delete(`pinfail:${child.id}`);
  const accessToken = await signJwt(
    { sub: child.id as string, fam: family.id as string, role: "child" },
    c.env.JWT_SECRET,
    ACCESS_TTL_CHILD,
  );
  return c.json({
    accessToken,
    expiresIn: ACCESS_TTL_CHILD,
    child: { id: child.id, displayName: child.display_name, avatarId: child.avatar_id ?? null },
  });
});

export default auth;
