/**
 * Twee intrekkings-gaten uit de uitgebreide security-audit:
 *
 *  - Een pincodewijziging liet bestaande kind-sessies gewoon doorlopen. Een
 *    pincode wordt gewijzigd omdát de oude niet meer geheim is, dus moeten de
 *    toestellen die er nog mee ingelogd zijn eruit.
 *  - Elke aanroep van de uitnodigingsroutes gaf er een geldig token bij zonder
 *    het vorige in te trekken: tien keer klikken liet tien bruikbare
 *    uitnodigingen achter, elk goed voor ouder-toegang tot het gezin.
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { api, seedFamily, parentToken, childToken } from "./helpers";
import { sha256Hex } from "../src/services/passwords";

describe("pincodewijziging beëindigt bestaande kind-sessies", () => {
  it("maakt het lopende access-token en het device-token ongeldig", async () => {
    const { familyId, parentId, childA } = await seedFamily("pinrev");

    // Het kind is ingelogd: access-token + 30-daags device-token.
    const childAccess = await childToken(childA, familyId);
    const deviceToken = `dev_${crypto.randomUUID()}`;
    await env.DB
      .prepare(
        `INSERT INTO child_device_sessions (id, family_id, child_id, token_hash, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        `cds_${crypto.randomUUID().replace(/-/g, "")}`,
        familyId,
        childA,
        await sha256Hex(deviceToken),
        new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      )
      .run();

    expect((await api("/points/balance", { token: childAccess })).status).toBe(200);

    // De ouder zet een nieuwe pincode.
    const setPin = await api(`/members/${childA}/pincode`, {
      method: "POST",
      token: await parentToken(parentId, familyId),
      body: { pincode: "4321" },
    });
    expect(setPin.status).toBe(200);

    // Het oude access-token werkt niet meer...
    expect((await api("/points/balance", { token: childAccess })).status).toBe(401);

    // ...en het device-token kan geen nieuwe sessie meer opleveren.
    const refresh = await api("/auth/child-session/refresh", {
      method: "POST",
      body: { refreshToken: deviceToken },
    });
    expect(refresh.status).toBe(401);
  });
});

describe("uitnodigingstokens stapelen niet op", () => {
  it("trekt de vorige uitnodigingslink in zodra er een nieuwe wordt gemaakt", async () => {
    const { familyId, parentId } = await seedFamily("invrot");
    const token = await parentToken(parentId, familyId);

    const invited = await api("/families/me/parents", {
      method: "POST",
      token,
      idempotencyKey: `inv-${crypto.randomUUID()}`,
      body: { email: `co-${crypto.randomUUID()}@invite.test.local`, permissions: "full" },
    });
    expect(invited.status).toBe(201);
    const { userId } = (await invited.json()) as { userId: string };

    const linkOf = async () => {
      const res = await api(`/families/me/invites/${userId}/link`, { token });
      expect(res.status).toBe(200);
      const { copyableUrl } = (await res.json()) as { copyableUrl: string };
      return new URL(copyableUrl).searchParams.get("token")!;
    };

    const first = await linkOf();
    const second = await linkOf();
    expect(second).not.toBe(first);

    // Alleen de laatste link is nog bruikbaar.
    expect(await env.KV.get(`parentinvite:${first}`)).toBeNull();
    expect(await env.KV.get(`parentinvite:${second}`)).not.toBeNull();

    // En de ingetrokken link wordt ook echt geweigerd bij accepteren.
    const staleAccept = await api("/families/parents/accept", {
      method: "POST",
      body: { token: first, password: "co-parent-secret-1", displayName: "Mede-ouder" },
    });
    expect(staleAccept.status).toBe(400);
  });

  it("ruimt na accepteren niets bruikbaars op de uitgenodigde achter", async () => {
    const { familyId, parentId } = await seedFamily("invacc");
    const token = await parentToken(parentId, familyId);

    const invited = await api("/families/me/parents", {
      method: "POST",
      token,
      idempotencyKey: `inv-${crypto.randomUUID()}`,
      body: { email: `co-${crypto.randomUUID()}@invite.test.local`, permissions: "approve_only" },
    });
    const { userId } = (await invited.json()) as { userId: string };

    const res = await api(`/families/me/invites/${userId}/link`, { token });
    const { copyableUrl } = (await res.json()) as { copyableUrl: string };
    const inviteToken = new URL(copyableUrl).searchParams.get("token")!;

    const accepted = await api("/families/parents/accept", {
      method: "POST",
      body: { token: inviteToken, password: "co-parent-secret-1", displayName: "Mede-ouder" },
    });
    expect(accepted.status).toBe(200);

    expect(await env.KV.get(`parentinvite:${inviteToken}`)).toBeNull();
    expect(await env.KV.get(`parentinvite:current:${familyId}:${userId}`)).toBeNull();
  });
});
