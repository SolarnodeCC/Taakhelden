/**
 * Intrekken van reeds uitgegeven access-tokens.
 *
 * Access-JWT's zijn stateless: de auth-middleware doet geen DB-lookup en kan dus
 * niet zien dat een subject intussen verwijderd is of dat een ouder de sessies
 * van een kind heeft ingetrokken. Zonder deze check bleef zo'n token geldig tot
 * het verliep — en gaf `POST /members/:id/device-sessions/revoke` een succes
 * terug dat feitelijk niets introk.
 *
 * We houden per gebruiker een "revocation epoch" bij: het moment waarop alles
 * wat daarvóór is uitgegeven ongeldig werd. De middleware vergelijkt dat met de
 * `iat` van het token. Eén KV-read per request, geen D1 in het hete pad.
 *
 * KV is eventually consistent (orde van seconden). Dat is ruim binnen de marge
 * die we hier nodig hebben — het gat dat we dichten was tot 24 uur.
 */
import type { Env } from "../types";
import type { JwtPayload } from "./jwt";

const revocationKey = (userId: string) => `rev:${userId}`;

/**
 * Moet langer zijn dan de langstlevende access-token, anders vervalt de
 * markering terwijl er nog geldige tokens van vóór de intrekking rondgaan.
 */
const REVOCATION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Alles wat vóór nu voor deze gebruiker is uitgegeven, is per direct ongeldig. */
export async function revokeIssuedTokens(env: Pick<Env, "KV">, userId: string): Promise<void> {
  await env.KV.put(revocationKey(userId), String(Date.now()), {
    expirationTtl: REVOCATION_TTL_SECONDS,
  });
}

export async function isTokenRevoked(
  env: Pick<Env, "KV">,
  payload: JwtPayload,
): Promise<boolean> {
  const revokedAt = await env.KV.get(revocationKey(payload.sub));
  if (!revokedAt) return false;
  // Zonder `iat` valt niet te bewijzen dat dit token ná de intrekking is
  // uitgegeven — dan weigeren we het.
  if (typeof payload.iat !== "number") return true;
  return payload.iat * 1000 < Number(revokedAt);
}
