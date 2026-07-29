/**
 * Secret used for HMAC-signed photo/export transfer URLs.
 *
 * Prefer a dedicated `HMAC_SECRET` so a leak of transfer URLs does not also
 * compromise JWT signing. Falls back to `JWT_SECRET` for local/dev and until
 * operators rotate secrets in production (backward compatible).
 */
import type { Env } from "../types";

export function transferHmacSecret(env: Pick<Env, "JWT_SECRET" | "HMAC_SECRET">): string {
  return env.HMAC_SECRET || env.JWT_SECRET;
}
