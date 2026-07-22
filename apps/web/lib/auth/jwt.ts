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
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf8");
    const claims = JSON.parse(json) as Partial<JwtClaims>;
    if (!claims.sub || !claims.fam || !claims.role) return null;
    return claims as JwtClaims;
  } catch {
    return null;
  }
}
