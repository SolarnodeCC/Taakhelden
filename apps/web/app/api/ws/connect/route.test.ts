import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ErrorCodes } from "@taakhelden/shared";

const getAccessToken = vi.fn<() => Promise<string | undefined>>();
const refreshTokens = vi.fn<() => Promise<string | null>>();
const clearTokens = vi.fn<() => Promise<void>>(async () => undefined);

vi.mock("../../../../lib/auth/session", () => ({
  getAccessToken: () => getAccessToken(),
  refreshTokens: () => refreshTokens(),
  clearTokens: () => clearTokens(),
}));

vi.mock("../../../../lib/api/config", () => ({
  getApiBaseUrl: () => "http://worker.test/v1",
  apiFetch: (path: string, init?: RequestInit) =>
    fetch(`http://worker.test/v1${path.startsWith("/") ? path : `/${path}`}`, init),
}));

describe("POST /api/ws/connect", () => {
  beforeEach(() => {
    getAccessToken.mockReset();
    refreshTokens.mockReset();
    clearTokens.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns token and derived wsUrl on happy path", async () => {
    const { POST } = await import("./route");
    getAccessToken.mockResolvedValue("access-jwt");
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ token: "ws-token", expiresIn: 60 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      token: "ws-token",
      expiresIn: 60,
      wsUrl: "ws://worker.test/v1/ws",
    });
    expect(fetch).toHaveBeenCalledWith("http://worker.test/v1/ws/token", {
      method: "POST",
      headers: { Authorization: "Bearer access-jwt" },
      cache: "no-store",
    });
  });

  it("returns 401 when not authenticated", async () => {
    const { POST } = await import("./route");
    getAccessToken.mockResolvedValue(undefined);
    refreshTokens.mockResolvedValue(null);

    const res = await POST();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe(ErrorCodes.UNAUTHORIZED);
    expect(fetch).not.toHaveBeenCalled();
  });
});
