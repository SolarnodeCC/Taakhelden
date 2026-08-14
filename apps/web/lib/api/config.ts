import { getCloudflareContext } from "@opennextjs/cloudflare";

const DEFAULT_API_BASE_URL = "http://localhost:8787/v1";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/** True when `url` targets Cloudflare's shared `*.workers.dev` zone. */
function isWorkersDevUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".workers.dev");
  } catch {
    return false;
  }
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
 * The end user's IP, to forward to the API Worker.
 *
 * The BFF reaches the Worker over a service binding with a freshly constructed
 * Request, so Cloudflare does not set `CF-Connecting-IP` on it. Without this the
 * Worker cannot identify the caller and every rate limit degrades into a single
 * shared counter, letting one client lock everyone out.
 *
 * `CF-Connecting-IP` is set by Cloudflare's edge and overwrites anything the
 * client sent, so it is trustworthy. `X-Forwarded-For` is NOT: Cloudflare
 * appends to it rather than replacing it, so its first element is whatever the
 * client put there. It stays as a fallback only for local `next dev`, where no
 * edge header exists; behind Cloudflare the first branch always wins. Never
 * promote this value to anything but a rate-limit key.
 */
export function forwardedClientIp(req: Request): string | null {
  const direct = req.headers.get("CF-Connecting-IP");
  if (direct) return direct;
  return req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || null;
}

/**
 * Reject a cross-site state-changing request.
 *
 * The BFF authenticates purely from the `th_at` cookie, so `SameSite=lax` is
 * currently the only thing standing between a cross-site POST and every family
 * mutation (create child, set PIN, adjust points, delete account). That is one
 * control with no backstop. Comparing `Origin` to the request's own origin is
 * stateless, needs no token plumbing, and does not depend on cookie semantics.
 *
 * Returns a 403 response when the request must be rejected, or `null` to
 * continue. Safe methods are never blocked; a missing `Origin` is allowed
 * because non-browser clients (and some same-origin navigations) omit it, and
 * `SameSite` still covers the browser case there.
 */
export function crossOriginBlock(req: Request): Response | null {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return null;
  const origin = req.headers.get("Origin");
  if (!origin) return null;
  let expected: string;
  try {
    expected = new URL(req.url).origin;
  } catch {
    return null;
  }
  if (origin === expected) return null;
  return Response.json(
    { error: { code: "FORBIDDEN", message: "Ongeldige herkomst." } },
    { status: 403 },
  );
}

/** Base headers plus the forwarded client IP, for an outbound `apiFetch` call. */
export function forwardHeaders(
  req: Request,
  base: Record<string, string>,
): Record<string, string> {
  const clientIp = forwardedClientIp(req);
  return clientIp ? { ...base, "X-Forwarded-For": clientIp } : base;
}

/**
 * Server-side call to the API Worker.
 *
 * On Cloudflare, Workers in the same `*.workers.dev` zone cannot call each
 * other with global `fetch()` — that throws and the BFF returned 502. Use the
 * `API` service binding when present; fall back to `fetch(API_BASE_URL)` only
 * for local `next dev` / Vitest (non-workers.dev hosts).
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
    // No CF context — may use global fetch below for local/dev.
  }

  // Same-zone workers.dev fetch always fails without a service binding.
  // Prefer a clear error over an opaque UPSTREAM_UNAVAILABLE 502.
  if (isWorkersDevUrl(url)) {
    return Promise.reject(
      new Error(
        "API service binding (env.API) is required to call the API Worker on *.workers.dev",
      ),
    );
  }

  return fetch(url, init);
}
