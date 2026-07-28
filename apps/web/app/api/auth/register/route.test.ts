import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ErrorCodes } from "@taakhelden/shared";

const setTokens = vi.fn<(tokens: unknown) => Promise<void>>(async () => undefined);

vi.mock("../../../../lib/auth/session", () => ({
  setTokens: (tokens: unknown) => setTokens(tokens),
}));

vi.mock("../../../../lib/api/config", () => ({
  getApiBaseUrl: () => "http://worker.test/v1",
}));

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    setTokens.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const validBody = {
    email: "ouder@example.com",
    password: "TestPassword123",
    familyName: "De Vries",
    displayName: "Anna",
    turnstileToken: "dev-bypass",
  };

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
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    const res = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
    );

    expect(res.status).toBe(200);
    expect(setTokens).toHaveBeenCalledOnce();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://worker.test/v1/auth/register",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns 400 on invalid body without calling upstream", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      }),
    );

    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(setTokens).not.toHaveBeenCalled();
  });

  it("maps non-JSON upstream 404 to 502 UPSTREAM_UNAVAILABLE", async () => {
    const { POST } = await import("./route");
    vi.mocked(fetch).mockResolvedValue(new Response("404 Not Found", { status: 404 }));

    const res = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
    );

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe(ErrorCodes.UPSTREAM_UNAVAILABLE);
    expect(setTokens).not.toHaveBeenCalled();
  });

  it("forwards Worker JSON errors with their status", async () => {
    const { POST } = await import("./route");
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: ErrorCodes.EMAIL_IN_USE, message: "Dit e-mailadres is al in gebruik." },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );

    const res = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe(ErrorCodes.EMAIL_IN_USE);
  });
});
