import { describe, expect, it } from "vitest";
import { apiBaseToWsUrl } from "./wsUrl";

describe("apiBaseToWsUrl", () => {
  it("converts local http API base to ws URL", () => {
    expect(apiBaseToWsUrl("http://localhost:8787/v1")).toBe("ws://localhost:8787/v1/ws");
  });

  it("converts https API base to wss URL", () => {
    expect(apiBaseToWsUrl("https://taakhelden-api.example.workers.dev/v1")).toBe(
      "wss://taakhelden-api.example.workers.dev/v1/ws",
    );
  });

  it("appends /v1 when missing", () => {
    expect(apiBaseToWsUrl("http://localhost:8787")).toBe("ws://localhost:8787/v1/ws");
  });
});
