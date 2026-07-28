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
  "redemption.updated",
  "badge.earned",
]);
export type WsServerEvent = z.infer<typeof WsServerEvent>;

/** Payloads van DO-broadcasts (API-spec §3.13). */
export const WsInstanceUpdatedData = z.object({
  instanceId: z.string(),
  status: z.string(),
  childId: z.string(),
  photoStatus: z.string().optional(),
});
export type WsInstanceUpdatedData = z.infer<typeof WsInstanceUpdatedData>;

export const WsPointsChangedData = z.object({
  childId: z.string(),
  newBalance: z.number().int(),
});
export type WsPointsChangedData = z.infer<typeof WsPointsChangedData>;

export const WsRedemptionCreatedData = z.object({
  redemptionId: z.string(),
  rewardId: z.string(),
  childId: z.string(),
});
export type WsRedemptionCreatedData = z.infer<typeof WsRedemptionCreatedData>;

export const WsRedemptionUpdatedData = z.object({
  redemptionId: z.string(),
  status: z.string(),
  childId: z.string(),
});
export type WsRedemptionUpdatedData = z.infer<typeof WsRedemptionUpdatedData>;

export const WsBadgeEarnedData = z.object({
  childId: z.string(),
  badge: z.unknown(),
});
export type WsBadgeEarnedData = z.infer<typeof WsBadgeEarnedData>;

/** Wire-format van FamilyRoom → ouder-dashboard (JSON `{ event, data }`). */
export const WsMessage = z.object({
  event: WsServerEvent,
  data: z.unknown(),
});
export type WsMessage = z.infer<typeof WsMessage>;
