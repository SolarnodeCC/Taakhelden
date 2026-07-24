import { cookies } from "next/headers";
import type { TokenPair } from "@taakhelden/shared";

// httpOnly cookies are the only place tokens live — never exposed to client JS.
export const ACCESS_COOKIE = "th_at";
export const REFRESH_COOKIE = "th_rt";

const REFRESH_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, matches the API refresh TTL.

const baseOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** Persist the parent access (+ optional refresh) token as httpOnly cookies. */
export async function setAuthCookies(tokens: TokenPair): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions,
    maxAge: tokens.expiresIn,
  });
  if (tokens.refreshToken) {
    store.set(REFRESH_COOKIE, tokens.refreshToken, {
      ...baseOptions,
      maxAge: REFRESH_MAX_AGE,
    });
  }
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getAccessCookie(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function getRefreshCookie(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}
