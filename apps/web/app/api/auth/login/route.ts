import { NextResponse } from "next/server";
import { LoginBody, TokenPair, ErrorCodes } from "@taakhelden/shared";
import { API_BASE_URL } from "../../../../lib/api/config";
import { setTokens } from "../../../../lib/auth/session";

/** BFF login: forwards credentials to the Worker and stores tokens in httpOnly cookies. */
export async function POST(req: Request) {
  const parsed = LoginBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: ErrorCodes.VALIDATION_FAILED, message: "Ongeldige invoer." } },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: { code: ErrorCodes.VALIDATION_FAILED, message: "Kan de server niet bereiken." } },
      { status: 502 },
    );
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // Pass the Worker's error envelope (and status) straight through.
    return NextResponse.json(data ?? { error: { code: ErrorCodes.UNAUTHORIZED, message: "Inloggen mislukt." } }, {
      status: res.status,
    });
  }

  const tokens = TokenPair.safeParse(data);
  if (!tokens.success) {
    return NextResponse.json(
      { error: { code: ErrorCodes.VALIDATION_FAILED, message: "Onverwacht antwoord van de server." } },
      { status: 502 },
    );
  }

  setTokens(tokens.data);
  return NextResponse.json({ ok: true });
}
