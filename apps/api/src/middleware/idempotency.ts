import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../types";

/**
 * Cachet de response per (user, Idempotency-Key) 24u in KV.
 * Replay geeft exact dezelfde response terug — nooit dubbele punten.
 */
export const idempotency: MiddlewareHandler<AppBindings> = async (c, next) => {
  const key = c.req.header("Idempotency-Key");
  if (!key) return next(); // spec: verplicht op mutaties — routes checken zelf
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
