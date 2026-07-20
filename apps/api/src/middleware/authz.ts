import type { Context } from "hono";
import { ErrorCodes } from "@taakhelden/shared";
import { ApiException } from "./error";
import type { AppBindings } from "../types";

/** Alleen ouders (optioneel: alleen met 'full'-rechten). */
export function requireParent(c: Context<AppBindings>, opts?: { full?: boolean }) {
  const auth = c.get("auth");
  if (auth.role !== "parent") {
    throw new ApiException(403, ErrorCodes.FORBIDDEN, "Alleen voor ouders.");
  }
  if (opts?.full && auth.permissions !== "full") {
    throw new ApiException(403, ErrorCodes.FORBIDDEN, "Onvoldoende rechten.");
  }
  return auth;
}

/** Kind mag alleen bij zijn eigen resources; ouder mag altijd (binnen gezin). */
export function requireSelfOrParent(c: Context<AppBindings>, childId: string) {
  const auth = c.get("auth");
  if (auth.role === "parent") return auth;
  if (auth.userId !== childId) {
    throw new ApiException(403, ErrorCodes.FORBIDDEN, "Dit is niet van jou.");
  }
  return auth;
}
