/**
 * Decode a JWT payload without verifying the signature. Safe here because the
 * token comes from our own httpOnly cookie — a forged/tampered token simply
 * fails when the proxy forwards it to the Worker, which does verify. Never rely
 * on these claims for a security decision; they only drive UI (nav gating, name).
 */
export interface JwtClaims {
  sub: string; // userId
  fam: string; // familyId
  role: "parent" | "child";
  perm?: "full" | "approve_only";
}

export function decodeJwtPayload(token: string): JwtClaims | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = decodeBase64Url(part);
    const claims = JSON.parse(json) as Partial<JwtClaims>;
    if (!claims.sub || !claims.fam || !claims.role) return null;
    return claims as JwtClaims;
  } catch {
    return null;
  }
}

// Base64url → UTF-8, using only web-standard APIs (atob / TextDecoder) so this
// works on the Edge/Workers runtime as well as Node — `Buffer` is not available
// everywhere the BFF may be deployed.
function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
