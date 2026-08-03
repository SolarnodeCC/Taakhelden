import { NextResponse } from "next/server";
import { apiFetch, crossOriginBlock, forwardHeaders } from "../../../../lib/api/config";
import { getRefreshCookie } from "../../../../lib/api/cookies";
import { clearTokens } from "../../../../lib/auth/session";

/** BFF logout: best-effort revoke on the Worker, then clear cookies. */
export async function POST(req: Request) {
  const blocked = crossOriginBlock(req);
  if (blocked) return blocked;

  const refreshToken = await getRefreshCookie();

  if (refreshToken) {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        headers: forwardHeaders(req, { "Content-Type": "application/json" }),
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
