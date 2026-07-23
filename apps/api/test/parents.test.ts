/**
 * Co-ouder-uitnodiging → accept-flow (§3.2): tweede verzorger zet met het token
 * uit de uitnodigingsmail een eigen wachtwoord en kan daarna inloggen. Het token
 * is eenmalig en dubbel-accepteren wordt atomair afgevangen.
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { seedFamily, parentToken, api } from "./helpers";

describe("co-ouder accept-flow", () => {
  it("uitnodigen → accepteren zet wachtwoord + roepnaam en logt in", async () => {
    const fam = await seedFamily("coap");
    const parentTok = await parentToken(fam.parentId, fam.familyId);

    const invite = await api("/families/me/parents", {
      token: parentTok,
      body: { email: "co@test.local", permissions: "approve_only" },
    });
    expect(invite.status).toBe(201);
    const { inviteToken, userId } = (await invite.json()) as { inviteToken: string; userId: string };

    const accept = await api("/families/parents/accept", {
      body: { token: inviteToken, password: "meebeslissen1", displayName: "Opa" },
    });
    expect(accept.status).toBe(200);
    const body = (await accept.json()) as { userId: string; accessToken: string; refreshToken: string };
    expect(body.userId).toBe(userId);
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();

    // Wachtwoord + roepnaam staan nu op het profiel.
    const row = await env.DB
      .prepare("SELECT display_name, password_hash FROM users WHERE id = ?")
      .bind(userId)
      .first<{ display_name: string; password_hash: string | null }>();
    expect(row?.display_name).toBe("Opa");
    expect(row?.password_hash).toBeTruthy();

    // De nieuwe verzorger kan inloggen met dit wachtwoord.
    const login = await api("/auth/login", {
      body: { email: "co@test.local", password: "meebeslissen1" },
    });
    expect(login.status).toBe(200);
  });

  it("token is eenmalig: na accepteren faalt een tweede poging", async () => {
    const fam = await seedFamily("coap2");
    const parentTok = await parentToken(fam.parentId, fam.familyId);
    const invite = await api("/families/me/parents", {
      token: parentTok,
      body: { email: "co2@test.local", permissions: "full" },
    });
    const { inviteToken, userId } = (await invite.json()) as { inviteToken: string; userId: string };

    const first = await api("/families/parents/accept", {
      body: { token: inviteToken, password: "meebeslissen1" },
    });
    expect(first.status).toBe(200);

    // Token is uit KV verwijderd → 400.
    const second = await api("/families/parents/accept", {
      body: { token: inviteToken, password: "andereweg12" },
    });
    expect(second.status).toBe(400);

    // Zelfs met een opnieuw geplaatst token faalt het (wachtwoord staat al) → 409.
    await env.KV.put(
      `parentinvite:${inviteToken}`,
      JSON.stringify({ familyId: fam.familyId, userId }),
      { expirationTtl: 3600 },
    );
    const replayed = await api("/families/parents/accept", {
      body: { token: inviteToken, password: "nogeens123" },
    });
    expect(replayed.status).toBe(409);
  });

  it("onbekend token → 400", async () => {
    const res = await api("/families/parents/accept", {
      body: { token: "bestaat-niet", password: "meebeslissen1" },
    });
    expect(res.status).toBe(400);
  });
});
