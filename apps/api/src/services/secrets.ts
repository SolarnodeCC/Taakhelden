/**
 * Secret used for HMAC-signed photo/export transfer URLs.
 *
 * Deliberately NOT `JWT_SECRET`. Photo and export signatures travel in URL query
 * strings (`?fam=…&exp=…&sig=…`), where they reach browser history, `Referer`
 * headers, and proxy/CDN logs — a far higher-exposure surface than a bearer
 * token in a header. Sharing one key would mean a weakness reachable through
 * that surface also yields the ability to forge authentication tokens for every
 * family. Separate keys keep those blast radii apart and allow rotating the
 * transfer key after a leak without invalidating every session.
 *
 * Fails closed: `HMAC_SECRET` is in `[secrets] required` (wrangler.toml) and the
 * deploy workflow generates one when the environment has none, so an unset value
 * means a genuine misconfiguration rather than a reason to fall back.
 */
import type { Env } from "../types";

export function transferHmacSecret(env: Pick<Env, "HMAC_SECRET">): string {
  if (!env.HMAC_SECRET) {
    throw new Error("HMAC_SECRET is not configured");
  }
  return env.HMAC_SECRET;
}
