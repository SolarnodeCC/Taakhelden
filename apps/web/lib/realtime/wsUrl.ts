/**
 * Derive the public WebSocket upgrade URL from the server-only API base URL.
 * `API_BASE_URL` is typically `http(s)://host/v1` → `ws(s)://host/v1/ws`.
 */
export function apiBaseToWsUrl(apiBaseUrl: string): string {
  const trimmed = apiBaseUrl.replace(/\/$/, "");
  const httpBase = trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
  return `${httpBase.replace(/^http/, "ws")}/ws`;
}
