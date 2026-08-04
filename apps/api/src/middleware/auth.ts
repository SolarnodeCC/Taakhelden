import type { MiddlewareHandler } from "hono";
import { ErrorCodes } from "@taakhelden/shared";
import { ApiException } from "./error";
import type { AppBindings, AuthContext } from "../types";
import { verifyJwt } from "../services/jwt";
import { isTokenRevoked } from "../services/revocation";

export const authMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new ApiException(401, ErrorCodes.UNAUTHORIZED, "Inloggen vereist.");
  }
  const payload = await verifyJwt(header.slice(7), c.env.JWT_SECRET);
  if (!payload || payload.typ === "ws") {
    // Een kortlevend ws-token mag nooit een gewone API-call authenticeren.
    throw new ApiException(401, ErrorCodes.UNAUTHORIZED, "Sessie verlopen, log opnieuw in.");
  }
  // Een geldige handtekening zegt niets over intrekking: kind verwijderd, sessies
  // ingetrokken of uitgelogd moet meteen effect hebben, niet pas bij expiry.
  if (await isTokenRevoked(c.env, payload)) {
    throw new ApiException(401, ErrorCodes.UNAUTHORIZED, "Sessie verlopen, log opnieuw in.");
  }
  const auth: AuthContext = {
    userId: payload.sub,
    familyId: payload.fam,
    role: payload.role,
    permissions: payload.perm ?? "full",
  };
  c.set("auth", auth);
  await next();
};
