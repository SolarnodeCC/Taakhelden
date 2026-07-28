import { getCloudflareContext } from "@opennextjs/cloudflare";

const DEFAULT_API_BASE_URL = "http://localhost:8787/v1";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/**
 * Worker base URL for BFF proxying (must include the `/v1` prefix).
 *
 * Prefer the Cloudflare Worker binding (`wrangler.jsonc` `vars` / dashboard)
 * over `process.env`. OpenNext's Node `process.env` polyfill does not reliably
 * expose Worker bindings, which previously made the BFF fall back to a bad URL
 * and surface opaque 404s on `/api/auth/register` and `/api/auth/login`.
 */
export function getApiBaseUrl(): string {
  try {
    const { env } = getCloudflareContext();
    const fromBinding = (env as { API_BASE_URL?: string }).API_BASE_URL;
    if (typeof fromBinding === "string" && fromBinding.trim()) {
      return normalizeBaseUrl(fromBinding);
    }
  } catch {
    // Outside a request context (Vitest, or `next dev` without CF init).
  }

  // Bracket access avoids accidental build-time inlining of a single env key.
  const fromProcess = process.env["API_BASE_URL"];
  if (typeof fromProcess === "string" && fromProcess.trim()) {
    return normalizeBaseUrl(fromProcess);
  }

  return DEFAULT_API_BASE_URL;
}
