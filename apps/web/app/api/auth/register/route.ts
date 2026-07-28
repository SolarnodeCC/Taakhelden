import { NextResponse } from "next/server";
import { RegisterBody, TokenPair, ErrorCodes } from "@taakhelden/shared";
import { getApiBaseUrl } from "../../../../lib/api/config";
import { setTokens } from "../../../../lib/auth/session";

/** BFF register: creates parent + family, then stores tokens in httpOnly cookies. */
export async function POST(req: Request) {
  const parsed = RegisterBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: ErrorCodes.VALIDATION_FAILED, message: "Ongeldige invoer." } },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}/auth/register`, {
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
    // Non-JSON upstream (e.g. wrong API_BASE_URL → plain 404) must not look like
    // a validation failure to the client.
    if (!data) {
      return NextResponse.json(
        { error: { code: ErrorCodes.UPSTREAM_UNAVAILABLE, message: "Kan de server niet bereiken." } },
        { status: 502 },
      );
    }
    return NextResponse.json(data, { status: res.status });
  }

  const tokens = TokenPair.safeParse(data);
  if (!tokens.success) {
    return NextResponse.json(
      { error: { code: ErrorCodes.VALIDATION_FAILED, message: "Onverwacht antwoord van de server." } },
      { status: 502 },
    );
  }

  await setTokens(tokens.data);
  return NextResponse.json({ ok: true });
}
