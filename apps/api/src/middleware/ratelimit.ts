import type { Context } from "hono";
import { ErrorCodes } from "@taakhelden/shared";
import { ApiException } from "./error";
import type { AppBindings } from "../types";

/**
 * Eenvoudige KV-teller per sleutel (fixed window, min. 60 s door KV-TTL).
 * Niet atomair — voor MVP-schaal ruim voldoende; strengere handhaving kan
 * later via de Workers Rate Limiting API / WAF (zie architectuurdoc §3).
 */
export async function rateLimit(
  c: Context<AppBindings>,
  bucket: string,
  limit: number,
  windowSeconds = 60,
): Promise<void> {
  const ip = c.req.header("CF-Connecting-IP") ?? "local";
  const window = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `rl:${bucket}:${ip}:${window}`;
  const current = Number((await c.env.KV.get(key)) ?? "0");
  if (current >= limit) {
    throw new ApiException(429, ErrorCodes.RATE_LIMITED, "Even rustig aan — probeer het zo weer.");
  }
  await c.env.KV.put(key, String(current + 1), { expirationTtl: Math.max(windowSeconds * 2, 60) });
}
