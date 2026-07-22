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
export function setAuthCookies(tokens: TokenPair): void {
  const store = cookies();
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

export function clearAuthCookies(): void {
  const store = cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export function getAccessCookie(): string | undefined {
  return cookies().get(ACCESS_COOKIE)?.value;
}

export function getRefreshCookie(): string | undefined {
  return cookies().get(REFRESH_COOKIE)?.value;
}
