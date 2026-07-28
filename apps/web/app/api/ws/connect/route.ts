import { NextResponse } from "next/server";
import { ErrorCodes, WsTokenResponse } from "@taakhelden/shared";
import { getApiBaseUrl } from "../../../../lib/api/config";
import { apiBaseToWsUrl } from "../../../../lib/realtime/wsUrl";
import { WsConnectResponse } from "../../../../lib/realtime/types";
import { getAccessToken, refreshTokens, clearTokens } from "../../../../lib/auth/session";

/**
 * Mint a short-lived FamilyRoom WebSocket token and return the upgrade URL.
 * The browser cannot send Authorization on WebSocket, so connect uses ?token=.
 */
export async function POST(): Promise<Response> {
  const apiBase = getApiBaseUrl();
  const send = (token: string) =>
    fetch(`${apiBase}/ws/token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

  const token = (await getAccessToken()) ?? (await refreshTokens());
  if (!token) {
    return NextResponse.json(
      { error: { code: ErrorCodes.UNAUTHORIZED, message: "Inloggen vereist." } },
      { status: 401 },
    );
  }

  let res: Response;
  try {
    res = await send(token);
    if (res.status === 401) {
      const refreshed = await refreshTokens();
      if (!refreshed) {
        await clearTokens();
        return NextResponse.json(
          { error: { code: ErrorCodes.UNAUTHORIZED, message: "Sessie verlopen." } },
          { status: 401 },
        );
      }
      res = await send(refreshed);
    }
  } catch {
    return NextResponse.json(
      { error: { code: ErrorCodes.UPSTREAM_UNAVAILABLE, message: "Kan de server niet bereiken." } },
      { status: 502 },
    );
  }

  if (!res.ok) {
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  }

  const parsed = WsTokenResponse.safeParse(await res.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: ErrorCodes.UPSTREAM_UNAVAILABLE, message: "Ongeldig ws-token antwoord." } },
      { status: 502 },
    );
  }

  const payload: WsConnectResponse = {
    ...parsed.data,
    wsUrl: apiBaseToWsUrl(apiBase),
  };

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
