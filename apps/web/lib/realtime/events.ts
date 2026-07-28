import type { WsServerEvent } from "@taakhelden/shared";

/** Internal signal emitted after a successful (re)connect. */
export type RealtimeSignal = WsServerEvent | "connected";

export const TODAY_REALTIME_EVENTS: WsServerEvent[] = ["instance.updated", "points.changed"];

export const APPROVAL_REALTIME_EVENTS: WsServerEvent[] = ["instance.updated"];

export const SHOP_REALTIME_EVENTS: WsServerEvent[] = ["redemption.created", "redemption.updated"];

export const WEEK_REALTIME_EVENTS: WsServerEvent[] = ["instance.updated"];

/** Events the web dashboard reacts to; badge.earned is parsed but not surfaced. */
export function isActionableRealtimeEvent(event: WsServerEvent): boolean {
  return event !== "badge.earned";
}
