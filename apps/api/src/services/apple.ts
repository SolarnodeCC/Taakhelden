/**
 * Sign in with Apple: identityToken (JWT, RS256) verifiëren tegen Apples JWKS.
 * jose cachet de opgehaalde keys in het geheugen van de Worker-isolate.
 */
import { createRemoteJWKSet, jwtVerify } from "jose";

const APPLE_ISSUER = "https://appleid.apple.com";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export interface AppleClaims {
  sub: string; // stabiel Apple-subject — onze koppelsleutel (users.apple_sub)
  email: string | null; // kan een private-relay-adres zijn; bij herlogin soms afwezig
  /**
   * Heeft Apple dit adres geverifieerd? Apple stuurt de claim als boolean óf als
   * string. Alleen een geverifieerd adres mag een Apple-account aan een bestaand
   * wachtwoord-account koppelen: op een onbevestigd adres zou het aanmaken van
   * een Apple ID met andermans e-mailadres genoeg zijn om dat account over te
   * nemen zonder ooit het wachtwoord te kennen.
   */
  emailVerified: boolean;
}

/**
 * Wat te doen met een geverifieerd Apple-identiteitstoken waarvoor nog geen
 * `apple_sub`-koppeling bestaat.
 *
 *  - `link`   — koppel aan het bestaande account met dit adres.
 *  - `refuse` — het adres hoort bij een bestaand account, maar Apple staat er
 *               niet voor in. Koppelen zou account-overname zijn; stilzwijgend
 *               een tweede gezin aanmaken laat de ouder z'n kinderen kwijtraken
 *               zonder uitleg. Dus: vragen om de bekende inlog.
 *  - `create` — nieuw gezin. Een onbevestigd adres leggen we niet vast: Apple
 *               staat er niet voor in, en het zou de UNIQUE-index bezetten voor
 *               wie het adres wél kan bewijzen.
 *
 * Losse functie omdat dit de hele beveiligingsbeslissing van de Apple-flow is:
 * zo is hij uitputtend te testen zonder Apples JWKS.
 */
export type AppleAccountAction =
  | { kind: "link" }
  | { kind: "refuse" }
  | { kind: "create"; email: string | null };

export function decideAppleAccount(
  claims: Pick<AppleClaims, "email" | "emailVerified">,
  hasAccountWithEmail: boolean,
): AppleAccountAction {
  if (!claims.email) return { kind: "create", email: null };
  if (hasAccountWithEmail) {
    return claims.emailVerified ? { kind: "link" } : { kind: "refuse" };
  }
  return { kind: "create", email: claims.emailVerified ? claims.email : null };
}

export async function verifyAppleIdentityToken(
  identityToken: string,
  clientId: string,
): Promise<AppleClaims | null> {
  try {
    jwks ??= createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));
    const { payload } = await jwtVerify(identityToken, jwks, {
      issuer: APPLE_ISSUER,
      audience: clientId,
    });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
      emailVerified: payload.email_verified === true || payload.email_verified === "true",
    };
  } catch {
    return null; // ongeldig/verlopen token of JWKS onbereikbaar → gewoon 401
  }
}
