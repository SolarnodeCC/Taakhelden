import { NextResponse } from "next/server";
import { ErrorCodes } from "@taakhelden/shared";
import { API_BASE_URL } from "../../../../lib/api/config";
import { getAccessToken, refreshTokens, clearTokens } from "../../../../lib/auth/session";

/**
 * Authenticated BFF proxy — the shared core for every later batch's data calls.
 * Forwards `/api/v1/<path>` to the Worker with the parent's bearer token, and on
 * a 401 transparently refreshes (rotating cookies) and retries once.
 */
async function proxy(req: Request, path: string[]): Promise<Response> {
  const target = new URL(req.url);
  const url = `${API_BASE_URL}/${path.join("/")}${target.search}`;

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.text() : undefined;

  const buildHeaders = (token: string): HeadersInit => {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    const contentType = req.headers.get("Content-Type");
    if (contentType) headers["Content-Type"] = contentType;
    // Preserve idempotency keys for future mutation endpoints.
    const idempotencyKey = req.headers.get("Idempotency-Key");
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    return headers;
  };

  const send = (token: string) =>
    fetch(url, { method: req.method, headers: buildHeaders(token), body, cache: "no-store" });

  let token = getAccessToken() ?? (await refreshTokens());
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
        clearTokens();
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

  // Stream the Worker's response back (status + body + content-type). Mark it
  // no-store so per-family authenticated data is never cached by intermediaries.
  return new NextResponse(res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

type Ctx = { params: { path: string[] } };

export const GET = (req: Request, { params }: Ctx) => proxy(req, params.path);
export const POST = (req: Request, { params }: Ctx) => proxy(req, params.path);
export const PUT = (req: Request, { params }: Ctx) => proxy(req, params.path);
export const PATCH = (req: Request, { params }: Ctx) => proxy(req, params.path);
export const DELETE = (req: Request, { params }: Ctx) => proxy(req, params.path);
