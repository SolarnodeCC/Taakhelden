import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ErrorCodes } from "@taakhelden/shared";

/**
 * Lightweight unit coverage for the accept-parent BFF route handler.
 * Mocks upstream Worker fetch + cookie writes.
 */

const setTokens = vi.fn(async (_tokens: unknown) => undefined);

vi.mock("../../../../lib/auth/session", () => ({
  setTokens: (tokens: unknown) => setTokens(tokens),
}));

vi.mock("../../../../lib/api/config", () => ({
  API_BASE_URL: "http://worker.test/v1",
}));

describe("POST /api/auth/accept-parent", () => {
  beforeEach(() => {
    setTokens.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets cookies on happy path", async () => {
    const { POST } = await import("./route");
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: "access",
          refreshToken: "refresh",
          expiresIn: 3600,
          userId: "usr_1",
          familyId: "fam_1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const res = await POST(
      new Request("http://localhost/api/auth/accept-parent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "invite-token",
          password: "achttekens",
          displayName: "Opa",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(setTokens).toHaveBeenCalledWith({
      accessToken: "access",
      refreshToken: "refresh",
      expiresIn: 3600,
    });
  });

  it("returns VALIDATION_FAILED for short password", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/auth/accept-parent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "invite-token", password: "kort" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
    expect(setTokens).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards INVALID_INVITE from the Worker", async () => {
    const { POST } = await import("./route");
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: ErrorCodes.INVALID_INVITE, message: "ongeldig" },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    const res = await POST(
      new Request("http://localhost/api/auth/accept-parent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "bad", password: "achttekens" }),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe(ErrorCodes.INVALID_INVITE);
    expect(setTokens).not.toHaveBeenCalled();
  });
});
