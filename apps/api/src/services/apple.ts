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
