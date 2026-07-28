import { afterEach, describe, expect, it, vi } from "vitest";

describe("getApiBaseUrl / apiFetch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("@opennextjs/cloudflare");
    vi.unstubAllGlobals();
  });

  it("prefers the Cloudflare Worker binding over process.env", async () => {
    vi.stubEnv("API_BASE_URL", "http://from-process/v1");
    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () => ({
        env: { API_BASE_URL: "https://from-binding.example/v1/" },
        cf: undefined,
        ctx: {} as never,
      }),
    }));

    const { getApiBaseUrl } = await import("./config");
    expect(getApiBaseUrl()).toBe("https://from-binding.example/v1");
  });

  it("falls back to process.env when the CF context is unavailable", async () => {
    vi.stubEnv("API_BASE_URL", "http://from-process/v1/");
    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () => {
        throw new Error("no context");
      },
    }));

    const { getApiBaseUrl } = await import("./config");
    expect(getApiBaseUrl()).toBe("http://from-process/v1");
  });

  it("defaults to local wrangler when nothing is configured", async () => {
    vi.stubEnv("API_BASE_URL", "");
    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () => {
        throw new Error("no context");
      },
    }));

    const { getApiBaseUrl } = await import("./config");
    expect(getApiBaseUrl()).toBe("http://localhost:8787/v1");
  });

  it("uses the API service binding when present", async () => {
    const bindingFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response("ok", { status: 200 }),
    );
    vi.stubEnv("API_BASE_URL", "https://api.example/v1");
    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () => ({
        env: {
          API_BASE_URL: "https://api.example/v1",
          API: { fetch: bindingFetch },
        },
        cf: undefined,
        ctx: {} as never,
      }),
    }));
    vi.stubGlobal("fetch", vi.fn());

    const { apiFetch } = await import("./config");
    await apiFetch("/auth/login", { method: "POST" });

    expect(bindingFetch).toHaveBeenCalledOnce();
    const req = bindingFetch.mock.calls[0]![0] as Request;
    expect(req.url).toBe("https://api.example/v1/auth/login");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to global fetch when no service binding exists", async () => {
    vi.stubEnv("API_BASE_URL", "http://localhost:8787/v1");
    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () => {
        throw new Error("no context");
      },
    }));
    const globalFetch = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", globalFetch);

    const { apiFetch } = await import("./config");
    await apiFetch("auth/login", { method: "POST" });

    expect(globalFetch).toHaveBeenCalledWith(
      "http://localhost:8787/v1/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
