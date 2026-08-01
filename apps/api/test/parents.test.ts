/**
 * Co-ouder-uitnodiging → accept-flow (§3.2): tweede verzorger zet met het token
 * uit de uitnodigingsmail een eigen wachtwoord en kan daarna inloggen. Het token
 * is eenmalig en dubbel-accepteren wordt atomair afgevangen.
 *
 * Na WS-TRUST-API (Option A, P1-locked): POST /families/me/parents retourneert
 * GEEN inviteToken meer. Token ophalen via GET /families/me/invites/:userId/link.
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { seedFamily, parentToken, api } from "./helpers";

/** Haal het invite-token op via de link-endpoint (Option A: nooit in de create-response). */
async function getInviteToken(userId: string, parentTok: string): Promise<string> {
  const linkRes = await api(`/families/me/invites/${userId}/link`, { token: parentTok });
  expect(linkRes.status).toBe(200);
  const { copyableUrl } = (await linkRes.json()) as { copyableUrl: string };
  const url = new URL(copyableUrl);
  const token = url.searchParams.get("token");
  if (!token) throw new Error("Geen token in copyableUrl");
  return token;
}

describe("co-ouder accept-flow", () => {
  it("uitnodigen → accepteren zet wachtwoord + roepnaam en logt in", async () => {
    const fam = await seedFamily("coap");
    const parentTok = await parentToken(fam.parentId, fam.familyId);

    const invite = await api("/families/me/parents", {
      token: parentTok,
      body: { email: "co@test.local", permissions: "approve_only" },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(invite.status).toBe(201);
    const inviteBody = (await invite.json()) as Record<string, unknown>;
    const userId = inviteBody.userId as string;

    // inviteToken is NIET meer aanwezig in de response (P1-locked, WS-TRUST-API).
    expect(inviteBody.inviteToken).toBeUndefined();
    expect(inviteBody.status).toBe("invited");

    // Token ophalen via de link-endpoint.
    const inviteToken = await getInviteToken(userId, parentTok);

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
      idempotencyKey: crypto.randomUUID(),
    });
    const { userId } = (await invite.json()) as { userId: string };
    const inviteToken = await getInviteToken(userId, parentTok);

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

  it("link-endpoint werkt alleen voor pending (nog niet geactiveerde) uitnodigingen", async () => {
    const fam = await seedFamily("coaplink");
    const parentTok = await parentToken(fam.parentId, fam.familyId);
    // Bestaand kind: geen pending invite.
    const notFound = await api(`/families/me/invites/${fam.childA}/link`, { token: parentTok });
    expect(notFound.status).toBe(404);
  });
});
