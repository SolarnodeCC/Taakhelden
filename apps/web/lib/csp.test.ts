import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCsp } from "./csp";

// WS-AI-WEBPOLICY: no third-party AI widget/script may ever load on wispel.cc.
// This is a regression guard, not a one-time review — a future PR that widens
// script-src to add a chat/AI widget domain should fail here first.
const KNOWN_AI_WIDGET_HOSTS = [
  "openai.com",
  "chatgpt.com",
  "anthropic.com",
  "claude.ai",
  "intercom.io",
  "drift.com",
  "chatbase.co",
  "voiceflow.com",
];

describe("buildCsp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not allowlist any third-party AI widget domain", () => {
    const csp = buildCsp("test-nonce");
    for (const host of KNOWN_AI_WIDGET_HOSTS) {
      expect(csp).not.toContain(host);
    }
  });

  it("keeps script-src limited to self, the nonce, strict-dynamic, and Turnstile", () => {
    const csp = buildCsp("test-nonce");
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrc?.trim()).toBe(
      "script-src 'self' 'nonce-test-nonce' 'strict-dynamic' https://challenges.cloudflare.com",
    );
  });

  it("never falls back to 'unsafe-inline' for scripts", () => {
    const csp = buildCsp("test-nonce");
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrc).not.toContain("unsafe-inline");
  });
});
