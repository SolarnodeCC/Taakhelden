import { SignJWT, jwtVerify } from "jose";

export interface JwtPayload {
  sub: string;
  fam: string;
  role: "parent" | "child";
  perm?: "full" | "approve_only";
  /** Tokensoort. Ontbreekt = normale access-JWT; "ws" = kortlevend WebSocket-token. */
  typ?: "ws";
}

const enc = (secret: string) => new TextEncoder().encode(secret);

export async function signJwt(payload: JwtPayload, secret: string, ttlSeconds: number) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(enc(secret));
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, enc(secret));
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
