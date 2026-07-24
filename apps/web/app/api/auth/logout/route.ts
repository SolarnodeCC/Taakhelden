import { NextResponse } from "next/server";
import { API_BASE_URL } from "../../../../lib/api/config";
import { getRefreshCookie } from "../../../../lib/api/cookies";
import { clearTokens } from "../../../../lib/auth/session";

/** BFF logout: best-effort revoke on the Worker, then clear cookies. */
export async function POST() {
  const refreshToken = await getRefreshCookie();

  if (refreshToken) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      });
    } catch {
      // Revoking is best-effort; we always clear local cookies below.
    }
  }

  await clearTokens();
  return NextResponse.json({ ok: true });
}
