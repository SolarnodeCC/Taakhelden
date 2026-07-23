/**
 * Devices + push. APNs zelf vergt Apple-secrets (in test leeg → stille no-op),
 * dus we testen de registratie-authz en de quiet-hours/limiet-logica direct.
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { seedFamily, parentToken, childToken, api } from "./helpers";
import { isQuietTime } from "../src/services/notifier";
import { deleteDeadDeviceToken } from "../src/repo/devices";

describe("device-registratie", () => {
  it("kind registreert eigen token; ouder mag token aan kindprofiel hangen (iPad)", async () => {
    const fam = await seedFamily("dev");
    const childTok = await childToken(fam.childA, fam.familyId);

    const own = await api("/devices", {
      token: childTok,
      body: { apnsToken: "a".repeat(64), platform: "ios" },
    });
    expect(own.status).toBe(201);

    // Ouder koppelt hetzelfde token ook aan het tweede kind
    const shared = await api("/devices", {
      token: await parentToken(fam.parentId, fam.familyId),
      body: { apnsToken: "a".repeat(64), userId: fam.childB },
    });
    expect(shared.status).toBe(201);

    const rows = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM devices WHERE apns_token = ?")
      .bind("a".repeat(64))
      .first<{ n: number }>();
    expect(rows?.n).toBe(2);
  });

  it("kind kan token niet aan een ander profiel hangen (403)", async () => {
    const fam = await seedFamily("dev2");
    const res = await api("/devices", {
      token: await childToken(fam.childA, fam.familyId),
      body: { apnsToken: "b".repeat(64), userId: fam.childB },
    });
    expect(res.status).toBe(403);
  });

  it("DELETE koppelt het token los binnen het gezin", async () => {
    const fam = await seedFamily("dev3");
    const childTok = await childToken(fam.childA, fam.familyId);
    await api("/devices", { token: childTok, body: { apnsToken: "c".repeat(64) } });

    const del = await api(`/devices/${"c".repeat(64)}`, { method: "DELETE", token: childTok });
    expect(del.status).toBe(200);
    const rows = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM devices WHERE apns_token = ?")
      .bind("c".repeat(64))
      .first<{ n: number }>();
    expect(rows?.n).toBe(0);
  });

  it("APNs 410: een dood token wordt overal opgeruimd", async () => {
    const fam = await seedFamily("dead");
    const token = "d".repeat(64);
    // Zelfde token aan twee profielen (gedeelde iPad).
    await env.DB
      .prepare("INSERT INTO devices (apns_token, user_id, platform) VALUES (?, ?, 'ios')")
      .bind(token, fam.parentId)
      .run();
    await env.DB
      .prepare("INSERT INTO devices (apns_token, user_id, platform) VALUES (?, ?, 'ios')")
      .bind(token, fam.childA)
      .run();

    await deleteDeadDeviceToken(env.DB, token);

    const rows = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM devices WHERE apns_token = ?")
      .bind(token)
      .first<{ n: number }>();
    expect(rows?.n).toBe(0);
  });
});

describe("quiet hours", () => {
  it("venster over middernacht (19:30 → 07:00)", () => {
    expect(isQuietTime("19:30", "07:00", "22:00")).toBe(true);
    expect(isQuietTime("19:30", "07:00", "06:00")).toBe(true);
    expect(isQuietTime("19:30", "07:00", "12:00")).toBe(false);
    expect(isQuietTime("19:30", "07:00", "07:00")).toBe(false); // einde exclusief
  });

  it("venster binnen dezelfde dag (13:00 → 14:00)", () => {
    expect(isQuietTime("13:00", "14:00", "13:30")).toBe(true);
    expect(isQuietTime("13:00", "14:00", "15:00")).toBe(false);
  });

  it("leeg venster (start == eind) blokkeert nooit", () => {
    expect(isQuietTime("08:00", "08:00", "08:00")).toBe(false);
  });
});
