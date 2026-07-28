import { z } from "zod";
import { WsTokenResponse } from "@taakhelden/shared";

/** BFF response: short-lived ws token + server-derived upgrade URL. */
export const WsConnectResponse = WsTokenResponse.extend({
  wsUrl: z.string().min(1),
});
export type WsConnectResponse = z.infer<typeof WsConnectResponse>;
