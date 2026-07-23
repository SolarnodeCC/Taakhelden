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

// Single-flight refresh: the API rotates refresh tokens as single-use, so if a
// page load fans out several authenticated requests that each find the access
// token expired, they must NOT each POST /auth/refresh — the first would consume
// the token and rotate it, and the rest would fail with the now-revoked token and
// wipe the session. Keyed by the refresh-token value so concurrent requests for
// the same session share one in-flight rotation (and one cookie write), while
// different sessions never collide.
const inFlightRefresh = new Map<string, Promise<string | null>>();

/**
 * Exchange the stored refresh token for a fresh token pair. The API rotates the
 * refresh token (single-use), so we overwrite both cookies. Returns the new
 * access token, or null when refresh is impossible (missing/expired/revoked).
 * Concurrent callers for the same refresh token are coalesced into one request.
 */
export function refreshTokens(): Promise<string | null> {
  const refreshToken = getRefreshCookie();
  if (!refreshToken) return Promise.resolve(null);

  const existing = inFlightRefresh.get(refreshToken);
  if (existing) return existing;

  const pending = doRefresh(refreshToken).finally(() => inFlightRefresh.delete(refreshToken));
  inFlightRefresh.set(refreshToken, pending);
  return pending;
}

async function doRefresh(refreshToken: string): Promise<string | null> {
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
