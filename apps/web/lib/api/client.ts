import { ApiErrorSchema, type ErrorCode } from "@taakhelden/shared";

/**
 * Client-safe fetch helper. Talks only to same-origin BFF routes under `/api`,
 * never the Worker directly. On a non-2xx response it throws an ApiClientError.
 * `code` is the stable API error code when the response matched the standard
 * envelope, or `null` for anything else (5xx, HTML error pages, network) so the
 * UI can fall back to a generic message instead of a misleading specific one.
 */
export class ApiClientError extends Error {
  constructor(
    public readonly code: ErrorCode | null,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function safeJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const json = safeJson(await res.text());

  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(json);
    if (parsed.success) {
      throw new ApiClientError(parsed.data.error.code, parsed.data.error.message, res.status);
    }
    // Non-envelope failure (5xx / proxy / network) — no meaningful code.
    throw new ApiClientError(null, `Request failed (${res.status})`, res.status);
  }

  return json as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
};
