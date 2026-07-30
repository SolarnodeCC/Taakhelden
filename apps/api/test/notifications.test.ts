import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import { exportPKCS8, generateKeyPair } from "jose";
import { seedFamily } from "./helpers";
import { notifyChild, notifyParents } from "../src/services/notifier";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("push-notifications", () => {
  it("respecteert disabled notification settings van een kind", async () => {
    const fam = await seedFamily("notifoff");
    await env.DB
      .prepare("INSERT INTO devices (apns_token, user_id, platform) VALUES (?, ?, 'ios')")
      .bind("x".repeat(64), fam.childA)
      .run();
    await env.DB
      .prepare(
        "INSERT INTO notification_settings (child_id, enabled, quiet_start, quiet_end, updated_at) VALUES (?, 0, NULL, NULL, datetime('now'))",
      )
      .bind(fam.childA)
      .run();

    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await notifyChild(
      { ...env, APNS_KEY: "k", APNS_KEY_ID: "kid", APNS_TEAM_ID: "team", APPLE_BUNDLE_ID: "app.bundle" },
      fam.familyId,
      fam.childA,
      "Er staat iets klaar.",
      { type: "task_open", childId: fam.childA },
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("gebruikt sandbox host, bundle id en custom payload voor parent pushes", async () => {
    const fam = await seedFamily("notifsend");
    await env.DB
      .prepare("INSERT INTO devices (apns_token, user_id, platform) VALUES (?, ?, 'ios')")
      .bind("y".repeat(64), fam.parentId)
      .run();
    const { privateKey } = await generateKeyPair("ES256", { extractable: true });
    const pkcs8 = await exportPKCS8(privateKey);

    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await notifyParents(
      {
        ...env,
        APNS_KEY: pkcs8,
        APNS_KEY_ID: "kid123",
        APNS_TEAM_ID: "team123",
        APPLE_BUNDLE_ID: "nl.taakhelden.app",
        APPLE_CLIENT_ID: "siwa-client-id",
        APNS_ENV: "sandbox",
      },
      fam.familyId,
      "Er wacht iets op je goedkeuring in Wispel.",
      { type: "approval_queue", refId: "rd_1", childId: fam.childA, contentAvailable: true },
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api.sandbox.push.apple.com/3/device/");
    expect((init.headers as Record<string, string>)["apns-topic"]).toBe("nl.taakhelden.app");
    const body = JSON.parse(String(init.body)) as {
      aps: { alert: { body: string }; "content-available"?: number };
      th: { type: string; refId: string };
    };
    expect(body.aps.alert.body).toBe("Er wacht iets op je goedkeuring in Wispel.");
    expect(body.aps["content-available"]).toBe(1);
    expect(body.th).toMatchObject({ type: "approval_queue", refId: "rd_1" });
  });
});
