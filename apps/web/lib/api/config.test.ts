import { afterEach, describe, expect, it, vi } from "vitest";

describe("getApiBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("@opennextjs/cloudflare");
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
});
