import { describe, expect, it } from "vitest";
import { wsBackoffDelay, WS_BACKOFF_MS } from "./backoff";

describe("wsBackoffDelay", () => {
  it("uses 2s, 4s, 8s then caps at 8s", () => {
    expect(wsBackoffDelay(0)).toBe(WS_BACKOFF_MS[0]);
    expect(wsBackoffDelay(1)).toBe(WS_BACKOFF_MS[1]);
    expect(wsBackoffDelay(2)).toBe(WS_BACKOFF_MS[2]);
    expect(wsBackoffDelay(9)).toBe(WS_BACKOFF_MS[2]);
  });
});
