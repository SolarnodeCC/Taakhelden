import { z } from "zod";

/**
 * Antwoord van `POST /ws/token`: een kortlevend token dat de browser in de
 * query string van `GET /ws?token=…` meegeeft. De native WebSocket-API kan
 * geen Authorization-header zetten, vandaar een apart token in plaats van de
 * access-JWT. Zie API-spec §3.13.
 */
export const WsTokenResponse = z.object({
  token: z.string(),
  expiresIn: z.number().int(), // seconden
});
export type WsTokenResponse = z.infer<typeof WsTokenResponse>;

/** Server-events die de Family-DO over de WebSocket broadcast (API-spec §3.13). */
export const WsServerEvent = z.enum([
  "instance.updated",
  "points.changed",
  "redemption.created",
  "badge.earned",
]);
export type WsServerEvent = z.infer<typeof WsServerEvent>;
