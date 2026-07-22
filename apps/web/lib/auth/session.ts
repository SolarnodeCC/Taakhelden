import { TokenPair } from "@taakhelden/shared";
import { API_BASE_URL } from "../api/config";
import {
  getAccessCookie,
  getRefreshCookie,
  setAuthCookies,
  clearAuthCookies,
} from "../api/cookies";

/**
 * Server-side parent session helpers. Tokens live only in httpOnly cookies;
 * these functions run in Route Handlers and server components.
 */

export function getAccessToken(): string | undefined {
  return getAccessCookie();
}

/** A session exists as long as we still hold a refresh token (access may be expired). */
export function isAuthenticated(): boolean {
  return Boolean(getRefreshCookie() ?? getAccessCookie());
}

export function setTokens(tokens: TokenPair): void {
  setAuthCookies(tokens);
}

export function clearTokens(): void {
  clearAuthCookies();
}

/**
 * Exchange the stored refresh token for a fresh token pair. The API rotates the
 * refresh token (single-use), so we overwrite both cookies. Returns the new
 * access token, or null when refresh is impossible (missing/expired/revoked).
 */
export async function refreshTokens(): Promise<string | null> {
  const refreshToken = getRefreshCookie();
  if (!refreshToken) return null;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!res.ok) {
    clearAuthCookies();
    return null;
  }

  const parsed = TokenPair.safeParse(await res.json());
  if (!parsed.success) {
    clearAuthCookies();
    return null;
  }

  setAuthCookies(parsed.data);
  return parsed.data.accessToken;
}
