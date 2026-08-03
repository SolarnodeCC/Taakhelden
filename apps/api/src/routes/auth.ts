import { Hono } from "hono";
import {
  RegisterBody,
  LoginBody,
  AppleAuthBody,
  FamilyCodeBody,
  ChildSessionBody,
  ChildSessionRefreshBody,
  RefreshBody,
  LogoutBody,
  ChildSessionResult,
  ErrorCodes,
} from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { validate } from "../middleware/validate";
import { callerIp, rateLimit, rateLimitSubject } from "../middleware/ratelimit";
import { newId, newFamilyCode } from "../services/ids";
import { issueChildTokens, issueParentTokens } from "../services/session";
import { hashSecret, needsRehash, verifySecret } from "../services/passwords";
import { verifyTurnstile } from "../services/turnstile";
import { verifyAppleIdentityToken } from "../services/apple";
import { notifyParents, parentCopy } from "../services/notifier";
import { revokeIssuedTokens } from "../services/revocation";
import * as repo from "../repo/auth";

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 15;
/** Bovengrens op de exponentiële backoff — een kind moet er ooit weer in kunnen. */
const PIN_MAX_LOCK_MINUTES = 4 * 60;

const auth = new Hono<AppBindings>();

type ParentRow = { id: string; family_id: string; permissions: string };

auth.post("/register", validate("json", RegisterBody), async (c) => {
  const body = c.req.valid("json");
  await rateLimit(c, "register", 5);
  // Ook per e-mailadres begrensd: werkt door als het IP roteert of ontbreekt.
  await rateLimitSubject(c, "register-email", body.email, 3, 3600);

  if (!c.env.JWT_SECRET) {
    console.error("unhandled", "JWT_SECRET is not configured");
    throw new Error("JWT_SECRET is not configured");
  }

  const human = await verifyTurnstile(c.env, body.turnstileToken, callerIp(c) ?? undefined);
  if (!human) {
    throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Verificatie mislukt, probeer het opnieuw.");
  }
  // Use emailInUse (no deleted_at filter) so UNIQUE conflicts become 409, not 500.
  if (await repo.emailInUse(c.env.DB, body.email)) {
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
  const body = c.req.valid("json");
  await rateLimit(c, "login", 5);
  // Per account, niet per bron: begrenst credential stuffing per doelwit, ook
  // als de aanvaller over veel IP's beschikt.
  await rateLimitSubject(c, "login-account", body.email, 10, 900);

  const user = await repo.getParentByEmail(c.env.DB, body.email);
  const ok =
    user?.password_hash && (await verifySecret(body.password, user.password_hash as string));
  if (!user || !ok) {
    throw new ApiException(401, ErrorCodes.INVALID_CREDENTIALS, "E-mail of wachtwoord klopt niet.");
  }
  // Migreer een hash met verouderde KDF-parameters nu we het wachtwoord toch in
  // handen hebben. Buiten de response om: dit mag inloggen niet vertragen of
  // laten falen.
  if (needsRehash(user.password_hash as string)) {
    c.executionCtx.waitUntil(
      hashSecret(body.password)
        .then((hash) => repo.updatePasswordHash(c.env.DB, user.id as string, hash))
        .catch(() => {}),
    );
  }
  const tokens = await issueParentTokens(c.env.DB, c.env.JWT_SECRET, user as unknown as ParentRow);
  return c.json({ familyId: user.family_id, userId: user.id, ...tokens });
});

/** Sign in with Apple: bestaand account (apple_sub of e-mail) of nieuw gezin. */
auth.post("/apple", validate("json", AppleAuthBody), async (c) => {
  await rateLimit(c, "apple", 5);
  const body = c.req.valid("json");

  const claims = await verifyAppleIdentityToken(
    body.identityToken,
    c.env.APPLE_CLIENT_ID ?? "",
  );
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
  await rateLimit(c, "refresh", 30);
  const presented = c.req.valid("json").refreshToken;
  const consumed = await repo.consumeRefreshToken(c.env.DB, presented);
  if (!consumed) {
    // Een al verbruikt token dat terugkomt betekent dat twee partijen het
    // hebben. Welke van de twee de dief is weten we niet, dus trekken we de
    // hele keten in: iedereen logt opnieuw in, de aanvaller houdt niets over.
    const reused = await repo.detectRefreshReuse(c.env.DB, presented);
    if (reused?.user_id) {
      await repo.revokeAllRefreshTokens(c.env.DB, reused.user_id);
      await revokeIssuedTokens(c.env, reused.user_id);
    }
    throw new ApiException(401, ErrorCodes.UNAUTHORIZED, "Sessie verlopen, log opnieuw in.");
  }
  const user = await repo.getUserById(c.env.DB, consumed.user_id as string);
  if (!user) {
    throw new ApiException(401, ErrorCodes.UNAUTHORIZED, "Sessie verlopen, log opnieuw in.");
  }
  const tokens = await issueParentTokens(c.env.DB, c.env.JWT_SECRET, user as unknown as ParentRow);
  return c.json(tokens);
});

auth.post("/logout", validate("json", LogoutBody), async (c) => {
  const consumed = await repo.revokeRefreshToken(c.env.DB, c.req.valid("json").refreshToken);
  // Ook het lopende access-token intrekken: uitloggen op een gedeelde computer
  // moet meteen effect hebben, niet pas als de JWT verloopt.
  if (consumed?.user_id) {
    await revokeIssuedTokens(c.env, consumed.user_id as string);
  }
  return c.json({ ok: true });
});

/** Stap 1 kind-login: gezinscode → kindprofielen. Zwaar rate-limited, geen PII. */
auth.post("/family-code", validate("json", FamilyCodeBody), async (c) => {
  const { familyCode } = c.req.valid("json");
  await rateLimit(c, "family-code", 10);
  // Ook per code: de kinderlijst achter een gezinscode mag niet vanaf veel IP's
  // te harvesten zijn.
  await rateLimitSubject(c, "family-code-value", familyCode, 20, 3600);
  const family = await repo.getFamilyByInviteCode(c.env.DB, familyCode);
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

/** Stap 2 kind-login: pincode → kind-access + device-refresh. */
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
    // Atomair ophogen + zo nodig locken: gelijktijdige pogingen kunnen de lock
    // niet meer ontlopen door allemaal dezelfde oude tellerstand te lezen.
    const { lockedUntil, justLocked } = await repo.registerPinFailure(
      c.env.DB,
      family.id as string,
      child.id as string,
      {
        maxAttempts: PIN_MAX_ATTEMPTS,
        baseLockMinutes: PIN_LOCK_MINUTES,
        maxLockMinutes: PIN_MAX_LOCK_MINUTES,
      },
    );
    if (justLocked) {
      // Ouders informeren — buiten de response om, en een APNs-fout blokkeert niets.
      c.executionCtx.waitUntil(
        notifyParents(
          c.env,
          family.id as string,
          parentCopy.pinLock(child.display_name as string),
          { type: "pin_lock", childId: child.id as string },
        ).catch(() => {}),
      );
    }
    if (lockedUntil) {
      throw new ApiException(403, ErrorCodes.PIN_LOCKED, "Even pauze! Probeer het straks nog eens.");
    }
    throw new ApiException(
      401,
      ErrorCodes.INVALID_CREDENTIALS,
      "Die pincode klopt niet helemaal — probeer het nog eens!",
    );
  }

  await repo.clearPinFailures(c.env.DB, family.id as string, child.id as string);
  return c.json(ChildSessionResult.parse(await issueChildTokens(c.env.DB, c.env.JWT_SECRET, {
    id: child.id as string,
    family_id: family.id as string,
    display_name: child.display_name as string,
    avatar_id: (child.avatar_id as string | null) ?? null,
    age_mode: (child.age_mode as string | null) ?? null,
  })));
});

auth.post("/child-session/refresh", validate("json", ChildSessionRefreshBody), async (c) => {
  await rateLimit(c, "child-refresh", 30);
  const consumed = await repo.consumeChildDeviceSession(c.env.DB, c.req.valid("json").refreshToken);
  const child = consumed && (await repo.getChildForLogin(
    c.env.DB,
    consumed.family_id as string,
    consumed.child_id as string,
  ));
  if (!child) {
    throw new ApiException(401, ErrorCodes.UNAUTHORIZED, "Sessie verlopen, koppel het toestel opnieuw.");
  }
  return c.json(ChildSessionResult.parse(await issueChildTokens(c.env.DB, c.env.JWT_SECRET, {
    id: child.id as string,
    family_id: consumed.family_id as string,
    display_name: child.display_name as string,
    avatar_id: (child.avatar_id as string | null) ?? null,
    age_mode: (child.age_mode as string | null) ?? null,
  })));
});

export default auth;
