import type { Context } from "hono";
import { ErrorCodes } from "@taakhelden/shared";
import { ApiException } from "./error";
import { sha256Hex } from "../services/passwords";
import type { AppBindings } from "../types";

/**
 * Eenvoudige KV-teller per sleutel (fixed window, min. 60 s door KV-TTL).
 * Niet atomair — voor MVP-schaal voldoende; strengere handhaving kan later via
 * de Workers Rate Limiting API / WAF (zie architectuurdoc §3).
 *
 * De sleutel MOET de aanroeper identificeren:
 *  - iOS praat rechtstreeks met de Worker → `CF-Connecting-IP`.
 *  - De browser gaat via de Next.js-BFF, die over een service binding een nieuw
 *    Request opbouwt. Cloudflare zet daar geen `CF-Connecting-IP` op, dus de BFF
 *    geeft het IP door in `X-Forwarded-For` (zie apps/web/app/api/**).
 *
 * Zonder identificeerbare aanroeper valt de teller NOOIT terug op een gedeelde
 * sleutel. Dat deed hij eerder wel ("local"), waardoor élke limiet in feite een
 * globale limiet werd en één client iedereen kon buitensluiten.
 */
export function callerIp(c: Context<AppBindings>): string | null {
  const direct = c.req.header("CF-Connecting-IP");
  if (direct) return direct;
  // Alleen de BFF zet deze header (service binding); hij is niet client-spoofbaar
  // omdat de BFF hem onvoorwaardelijk overschrijft.
  const forwarded = c.req.header("X-Forwarded-For");
  return forwarded?.split(",")[0]?.trim() || null;
}

async function bump(
  c: Context<AppBindings>,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const window = Math.floor(Date.now() / (windowSeconds * 1000));
  const windowKey = `${key}:${window}`;
  const current = Number((await c.env.KV.get(windowKey)) ?? "0");
  if (current >= limit) {
    throw new ApiException(429, ErrorCodes.RATE_LIMITED, "Even rustig aan — probeer het zo weer.");
  }
  await c.env.KV.put(windowKey, String(current + 1), {
    expirationTtl: Math.max(windowSeconds * 2, 60),
  });
}

/** Limiet per aanroeper (IP). */
export async function rateLimit(
  c: Context<AppBindings>,
  bucket: string,
  limit: number,
  windowSeconds = 60,
): Promise<void> {
  const ip = callerIp(c);
  // Geen identificeerbaar IP betekent een misconfiguratie, geen vrijbrief: geef
  // deze request een eigen sleutel zodat hij nooit het budget van een ander
  // opsoupeert. De subject-limieten hieronder blijven wél gewoon gelden.
  const subject = ip ?? `unidentified:${crypto.randomUUID()}`;
  await bump(c, `rl:${bucket}:${subject}`, limit, windowSeconds);
}

/**
 * Limiet op een niet-IP-subject: een account, een gezinscode. Werkt óók als het
 * IP ontbreekt of roteert, en begrenst daarmee credential stuffing per doelwit
 * in plaats van per bron.
 *
 * Het subject wordt gehasht: e-mailadressen en gezinscodes horen niet als
 * leesbare KV-sleutel te bestaan (privacyregel 5).
 */
export async function rateLimitSubject(
  c: Context<AppBindings>,
  bucket: string,
  subject: string,
  limit: number,
  windowSeconds = 60,
): Promise<void> {
  await bump(c, `rl:${bucket}:${await sha256Hex(subject.toLowerCase())}`, limit, windowSeconds);
}
