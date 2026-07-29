/**
 * Sessie-uitgifte (parent + child). Alle refresh-state leeft in D1, zodat
 * rotatie en revoke server-side afdwingbaar blijven.
 *
 * Parent-sessies uitgeven (access-JWT + refresh token). Gedeeld door de
 * inlog-routes en de co-ouder accept-flow, zodat token-uitgifte één bron heeft.
 */
import type { ChildSessionResult, TokenPair } from "@taakhelden/shared";
import { signJwt, type JwtPayload } from "./jwt";
import { storeChildDeviceSession, storeRefreshToken } from "../repo/auth";

export const ACCESS_TTL_PARENT = 60 * 60; //  1 u  (spec §1)
export const ACCESS_TTL_CHILD = 24 * 60 * 60; // 24 u
export const REFRESH_TTL_DAYS = 30;
export const CHILD_REFRESH_TTL_DAYS = 30;

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function issueParentTokens(
  db: D1Database,
  secret: string,
  user: { id: string; family_id: string; permissions: string },
): Promise<TokenPair> {
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  const payload: JwtPayload = {
    sub: user.id,
    fam: user.family_id,
    role: "parent",
    perm: user.permissions as "full" | "approve_only",
  };
  const refreshToken = randomToken();
  await storeRefreshToken(db, user.id, refreshToken, REFRESH_TTL_DAYS);
  return {
    accessToken: await signJwt(payload, secret, ACCESS_TTL_PARENT),
    refreshToken,
    expiresIn: ACCESS_TTL_PARENT,
  };
}

export async function issueChildTokens(
  db: D1Database,
  secret: string,
  child: {
    id: string;
    family_id: string;
    display_name: string;
    avatar_id: string | null;
    age_mode: string | null;
  },
): Promise<ChildSessionResult> {
  const payload: JwtPayload = {
    sub: child.id,
    fam: child.family_id,
    role: "child",
  };
  const refreshToken = randomToken();
  await storeChildDeviceSession(db, child.family_id, child.id, refreshToken, CHILD_REFRESH_TTL_DAYS);
  const ageMode =
    child.age_mode === "young" || child.age_mode === "teen" || child.age_mode === "mid"
      ? child.age_mode
      : "mid";
  return {
    accessToken: await signJwt(payload, secret, ACCESS_TTL_CHILD),
    refreshToken,
    expiresIn: ACCESS_TTL_CHILD,
    child: {
      id: child.id,
      displayName: child.display_name,
      avatarId: child.avatar_id,
      ageMode,
    },
  };
}
