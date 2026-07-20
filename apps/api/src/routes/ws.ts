/**
 * WebSocket-oppervlak (API-spec §3.13).
 *
 * De browser-WebSocket-API kan geen Authorization-header sturen, dus lopen we in
 * twee stappen:
 *   1. `POST /ws/token` (geauthenticeerd, ouder) → kortlevend ws-token (60 s).
 *   2. `GET /ws?token=…` (publiek) → verifieert het ws-token en forward't de
 *      upgrade naar de FamilyRoom-DO van het gezin, die daarna broadcast.
 *
 * Alleen ouder-dashboards verbinden: een kind zou anders punt-events van
 * broers/zussen meelezen (privacyregel + rollenmatrix §5).
 */
import { Hono } from "hono";
import { ErrorCodes, type WsTokenResponse } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { signJwt, verifyJwt } from "../services/jwt";

/** TTL van het ws-token: net genoeg om de verbinding op te zetten (spec §3.13). */
const WS_TOKEN_TTL = 60;

/** Geauthenticeerde token-uitgifte. Wordt achter de auth-middleware gemount. */
const wsAuthed = new Hono<AppBindings>();

wsAuthed.post("/token", async (c) => {
  const { userId, familyId, permissions } = requireParent(c);
  const token = await signJwt(
    { sub: userId, fam: familyId, role: "parent", perm: permissions, typ: "ws" },
    c.env.JWT_SECRET,
    WS_TOKEN_TTL,
  );
  const body: WsTokenResponse = { token, expiresIn: WS_TOKEN_TTL };
  return c.json(body);
});

/**
 * Publieke upgrade-handler. Staat los van de auth-middleware omdat de auth in de
 * query string zit (`?token=`) in plaats van in een header.
 */
export async function handleWsUpgrade(c: {
  req: { raw: Request };
  env: AppBindings["Bindings"];
}): Promise<Response> {
  const url = new URL(c.req.raw.url);
  const token = url.searchParams.get("token");
  if (c.req.raw.headers.get("Upgrade") !== "websocket") {
    throw new ApiException(426, ErrorCodes.VALIDATION_FAILED, "WebSocket-upgrade vereist.");
  }
  const payload = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!payload || payload.typ !== "ws" || payload.role !== "parent") {
    throw new ApiException(401, ErrorCodes.UNAUTHORIZED, "Ongeldig of verlopen ws-token.");
  }

  const stub = c.env.FAMILY_DO.get(c.env.FAMILY_DO.idFromName(payload.fam));
  return stub.fetch(c.req.raw);
}

export default wsAuthed;
