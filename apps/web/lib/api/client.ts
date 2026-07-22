import { ApiErrorSchema, ErrorCodes, type ErrorCode } from "@taakhelden/shared";

/**
 * Client-safe fetch helper. Talks only to same-origin BFF routes under `/api`,
 * never the Worker directly. On a non-2xx response it throws an ApiClientError
 * carrying the stable error code so the UI can map it to localized copy.
 */
export class ApiClientError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
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

  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(json);
    if (parsed.success) {
      throw new ApiClientError(parsed.data.error.code, parsed.data.error.message, res.status);
    }
    // Unexpected shape (network/proxy failure) — fall back to a generic code.
    throw new ApiClientError(ErrorCodes.VALIDATION_FAILED, `Request failed (${res.status})`, res.status);
  }

  return json as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
};
