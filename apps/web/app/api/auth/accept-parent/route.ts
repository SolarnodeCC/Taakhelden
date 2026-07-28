import { NextResponse } from "next/server";
import { ParentAcceptBody, TokenPair, ErrorCodes } from "@taakhelden/shared";
import { API_BASE_URL } from "../../../../lib/api/config";
import { setTokens } from "../../../../lib/auth/session";

/**
 * BFF accept-parent: public (like login/register). Forwards to Worker
 * POST /families/parents/accept, then overwrites httpOnly session cookies.
 * Intentionally bypasses /api/v1/* which requires an existing session.
 */
export async function POST(req: Request) {
  const parsed = ParentAcceptBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: ErrorCodes.VALIDATION_FAILED, message: "Ongeldige invoer." } },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/families/parents/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: { code: ErrorCodes.UPSTREAM_UNAVAILABLE, message: "Kan de server niet bereiken." } },
      { status: 502 },
    );
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return NextResponse.json(
      data ?? { error: { code: ErrorCodes.INVALID_INVITE, message: "Uitnodiging mislukt." } },
      { status: res.status },
    );
  }

  // ParentSessionResult extends TokenPair — parse the token fields we need for cookies.
  const tokens = TokenPair.safeParse(data);
  if (!tokens.success) {
    return NextResponse.json(
      { error: { code: ErrorCodes.VALIDATION_FAILED, message: "Onverwacht antwoord van de server." } },
      { status: 502 },
    );
  }

  // Overwrite any existing session (Batch 8 decision: no separate logout step).
  await setTokens(tokens.data);
  return NextResponse.json({ ok: true });
}
