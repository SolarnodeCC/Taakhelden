import { z } from "zod";

/**
 * Subprotocol waarmee de client zich bij `GET /ws` aanmeldt.
 *
 * De WebSocket-API kan geen Authorization-header zetten, dus het token reisde
 * eerst in de query string. Query strings belanden in browserhistorie,
 * `Referer`-headers en proxy-/CDN-logs — veel meer plekken dan een header. De
 * handshake-header `Sec-WebSocket-Protocol` kan de browser wél zetten, dus
 * daar gaat het token nu in: `["wispel.v1", "auth.<token>"]`.
 *
 * JWT's bestaan uit base64url-segmenten gescheiden door punten; dat zijn
 * allemaal geldige HTTP-tokentekens, dus ze passen in deze header.
 */
export const WS_SUBPROTOCOL = "wispel.v1";
export const WS_AUTH_PREFIX = "auth.";

/** Subprotocol-lijst voor `new WebSocket(url, …)`. */
export function wsAuthSubprotocols(token: string): [string, string] {
  return [WS_SUBPROTOCOL, `${WS_AUTH_PREFIX}${token}`];
}

/** Haalt het token uit een `Sec-WebSocket-Protocol`-header (server-kant). */
export function parseWsAuthSubprotocol(header: string | null | undefined): string | null {
  if (!header) return null;
  for (const entry of header.split(",")) {
    const trimmed = entry.trim();
    if (trimmed.startsWith(WS_AUTH_PREFIX)) {
      const token = trimmed.slice(WS_AUTH_PREFIX.length);
      if (token) return token;
    }
  }
  return null;
}

/**
 * Antwoord van `POST /ws/token`: een kortlevend token dat de client meegeeft in
 * het `auth.<token>`-subprotocol van `GET /ws`. Zie API-spec §3.13.
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
  date: z.string().optional(),
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
