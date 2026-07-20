import type { MiddlewareHandler } from "hono";
import { ErrorCodes } from "@taakhelden/shared";
import { ApiException } from "./error";
import type { AppBindings } from "../types";

/**
 * Cachet de response per (user, Idempotency-Key) 24u in KV.
 * Replay geeft exact dezelfde response terug — nooit dubbele punten.
 */
export const idempotency: MiddlewareHandler<AppBindings> = async (c, next) => {
  const key = c.req.header("Idempotency-Key");
  if (!key) return next(); // optioneel hier; verplichte routes zetten requireIdempotencyKey ervoor
  const auth = c.get("auth");
  const kvKey = `idem:${auth.userId}:${key}`;
  const cached = await c.env.KV.get(kvKey);
  if (cached) {
    return c.newResponse(cached, 200, { "Content-Type": "application/json", "Idempotent-Replay": "true" });
  }
  await next();
  if (c.res.status < 400) {
    const body = await c.res.clone().text();
    await c.env.KV.put(kvKey, body, { expirationTtl: 60 * 60 * 24 });
  }
};

/** Spec §3.5/§3.8: op complete en redeem is de header verplicht. */
export const requireIdempotencyKey: MiddlewareHandler<AppBindings> = async (c, next) => {
  if (!c.req.header("Idempotency-Key")) {
    throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Idempotency-Key header is verplicht.");
  }
  await next();
};
