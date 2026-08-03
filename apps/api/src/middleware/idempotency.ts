import type { Context, MiddlewareHandler } from "hono";
import { z } from "zod";
import { ErrorCodes } from "@taakhelden/shared";
import { ApiException } from "./error";
import { sha256Hex } from "../services/passwords";
import type { AppBindings } from "../types";

/** 24 uur — ruim genoeg voor clientretries, kort genoeg om KV bounded te houden. */
const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;

/** Envelope in KV. Gevalideerd i.p.v. gecast: KV-inhoud is niet per definitie van ons. */
const CachedResponse = z.object({
  /** Identificeert de operatie waarvoor de sleutel is gebruikt. */
  fp: z.string().min(1),
  body: z.string(),
});
type CachedResponse = z.infer<typeof CachedResponse>;

/**
 * Vingerafdruk van de operatie: methode, pad, query en body. Twee echte pogingen
 * van dezelfde actie leveren dezelfde afdruk; dezelfde sleutel op een ándere
 * actie niet.
 */
async function requestFingerprint(c: Context<AppBindings>): Promise<string> {
  const url = new URL(c.req.url);
  let body: string;
  try {
    body = await c.req.raw.clone().text();
  } catch {
    body = "";
  }
  return sha256Hex(`${c.req.method}:${url.pathname}${url.search}:${body}`);
}

function parseCached(raw: string): CachedResponse | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null; // Rij van vóór de envelope; hieronder als legacy behandeld.
  }
  const parsed = CachedResponse.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/**
 * Cachet de response per (user, Idempotency-Key, operatie) 24u in KV.
 * Replay van dezelfde actie geeft exact dezelfde response terug — nooit dubbele
 * punten. Dezelfde sleutel op een andere actie geeft 409: die stilzwijgend met
 * de eerste response beantwoorden liet de tweede mutatie verdampen terwijl de
 * client succes zag.
 */
export const idempotency: MiddlewareHandler<AppBindings> = async (c, next) => {
  const key = c.req.header("Idempotency-Key");
  if (!key) return next(); // optioneel hier; verplichte routes zetten requireIdempotencyKey ervoor
  const auth = c.get("auth");
  const kvKey = `idem:${auth.userId}:${key}`;
  const fingerprint = await requestFingerprint(c);

  const cached = await c.env.KV.get(kvKey);
  if (cached) {
    const entry = parseCached(cached);
    if (entry && entry.fp !== fingerprint) {
      throw new ApiException(
        409,
        ErrorCodes.IDEMPOTENCY_KEY_REUSED,
        "Deze Idempotency-Key is al voor een andere actie gebruikt.",
      );
    }
    // Legacy-rij zonder envelope: teruggeven zoals voorheen. Verloopt binnen 24u.
    return c.newResponse(entry?.body ?? cached, 200, {
      "Content-Type": "application/json",
      "Idempotent-Replay": "true",
    });
  }

  await next();
  if (c.res.status < 400) {
    const body = await c.res.clone().text();
    await c.env.KV.put(kvKey, JSON.stringify({ fp: fingerprint, body } satisfies CachedResponse), {
      expirationTtl: IDEMPOTENCY_TTL_SECONDS,
    });
  }
};

/** Spec §3.5/§3.8: op complete en redeem is de header verplicht. */
export const requireIdempotencyKey: MiddlewareHandler<AppBindings> = async (c, next) => {
  if (!c.req.header("Idempotency-Key")) {
    throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Idempotency-Key header is verplicht.");
  }
  await next();
};
