import { getCloudflareContext } from "@opennextjs/cloudflare";

const DEFAULT_API_BASE_URL = "http://localhost:8787/v1";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/**
 * Public/base URL of the API Worker (must include `/v1`).
 * Used for absolute URLs (e.g. browser WebSocket) and as the Request URL when
 * calling via the `API` service binding or local `fetch`.
 */
export function getApiBaseUrl(): string {
  try {
    const { env } = getCloudflareContext();
    const fromBinding = env.API_BASE_URL;
    if (typeof fromBinding === "string" && fromBinding.trim()) {
      return normalizeBaseUrl(fromBinding);
    }
  } catch {
    // Outside a request context (Vitest, or `next dev` without CF init).
  }

  const fromProcess = process.env["API_BASE_URL"];
  if (typeof fromProcess === "string" && fromProcess.trim()) {
    return normalizeBaseUrl(fromProcess);
  }

  return DEFAULT_API_BASE_URL;
}

/**
 * Server-side call to the API Worker.
 *
 * On Cloudflare, Workers in the same `*.workers.dev` zone cannot call each
 * other with global `fetch()` — that throws and the BFF returned 502. Use the
 * `API` service binding when present; fall back to `fetch(API_BASE_URL)` for
 * local `next dev` / Vitest.
 *
 * @param path - Path under `/v1`, e.g. `/auth/login` or `auth/login`
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${normalizedPath}`;

  try {
    const { env } = getCloudflareContext();
    if (env.API) {
      // Service binding ignores the hostname; path must match the API Worker.
      return env.API.fetch(new Request(url, init));
    }
  } catch {
    // No CF context — use global fetch below.
  }

  return fetch(url, init);
}
