import { NextResponse } from "next/server";
import { ForgotPasswordBody, ErrorCodes } from "@taakhelden/shared";
import { apiFetch, forwardHeaders } from "../../../../lib/api/config";

export async function POST(req: Request) {
  const parsed = ForgotPasswordBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: ErrorCodes.VALIDATION_FAILED, message: "Ongeldige invoer." } },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await apiFetch("/auth/forgot-password", {
      method: "POST",
      headers: forwardHeaders(req, { "Content-Type": "application/json" }),
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
      data ?? { error: { code: ErrorCodes.UPSTREAM_UNAVAILABLE, message: "Kan de server niet bereiken." } },
      { status: res.status },
    );
  }

  return NextResponse.json({ ok: true });
}
