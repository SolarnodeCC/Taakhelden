import { NextResponse } from "next/server";
import { ErrorCodes } from "@taakhelden/shared";
import { getAccessToken, refreshTokens } from "../../../lib/auth/session";
import { decodeJwtPayload } from "../../../lib/auth/jwt";

/**
 * Identity endpoint for the app shell. There is no `/me` on the API, so we read
 * the signed-in user's claims from the access token (refreshing first if it has
 * expired). Returns the info the shell needs to gate nav and greet the user.
 */
export async function GET() {
  const token = getAccessToken() ?? (await refreshTokens());
  if (!token) {
    return NextResponse.json(
      { error: { code: ErrorCodes.UNAUTHORIZED, message: "Inloggen vereist." } },
      { status: 401 },
    );
  }

  const claims = decodeJwtPayload(token);
  if (!claims) {
    return NextResponse.json(
      { error: { code: ErrorCodes.UNAUTHORIZED, message: "Sessie ongeldig." } },
      { status: 401 },
    );
  }

  return NextResponse.json({
    userId: claims.sub,
    familyId: claims.fam,
    role: claims.role,
    // Fail closed: a token missing the perm claim gets the least-privileged
    // level so we never flash management nav to a parent who lacks it.
    permissions: claims.perm ?? "approve_only",
  });
}
