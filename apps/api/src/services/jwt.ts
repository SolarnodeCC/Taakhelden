import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

/**
 * Vorm van de claims waar de autorisatie op steunt. `jwtVerify` bewijst alleen
 * dat de handtekening klopt, niet dat `role` of `fam` er ook echt zo uitzien —
 * en op die velden hangt de hele family-scoping. Daarom valideren i.p.v. casten.
 */
const JwtPayloadSchema = z.object({
  sub: z.string().min(1),
  fam: z.string().min(1),
  role: z.enum(["parent", "child"]),
  perm: z.enum(["full", "approve_only"]).optional(),
  typ: z.literal("ws").optional(),
  iat: z.number().optional(),
});

export interface JwtPayload {
  sub: string;
  fam: string;
  role: "parent" | "child";
  perm?: "full" | "approve_only";
  /** Tokensoort. Ontbreekt = normale access-JWT; "ws" = kortlevend WebSocket-token. */
  typ?: "ws";
  /**
   * Uitgiftemoment (seconden). Gezet door `signJwt`; de auth-middleware
   * vergelijkt het met de revocation epoch (services/revocation.ts) om
   * ingetrokken tokens te weigeren.
   */
  iat?: number;
}

const enc = (secret: string) => new TextEncoder().encode(secret);

export async function signJwt(payload: JwtPayload, secret: string, ttlSeconds: number) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(enc(secret));
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    // `algorithms` expliciet: met een symmetrische sleutel accepteert jose nu al
    // alleen HS*, maar dat is een eigenschap van het sleuteltype en niet iets om
    // op te leunen — pin het algoritme waarop we ondertekenen.
    //
    // Bewust géén issuer/audience: bestaande tokens dragen die claims niet, dus
    // afdwingen zou bij deploy iedereen in één klap uitloggen. Toevoegen kan
    // zodra sign en verify een overgangsperiode delen.
    const { payload } = await jwtVerify(token, enc(secret), { algorithms: ["HS256"] });
    const parsed = JwtPayloadSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
