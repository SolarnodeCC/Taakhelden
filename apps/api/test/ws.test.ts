/**
 * WebSocket-oppervlak (API-spec §3.13): ws-token uitgifte, authz en de
 * end-to-end upgrade → broadcast via de FamilyRoom-DO.
 */
import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";
import { seedFamily, seedTask, seedInstance, parentToken, childToken, api, todayAmsterdam } from "./helpers";

async function mintWsToken(token: string) {
  const res = await api("/ws/token", { method: "POST", token });
  return { status: res.status, body: (await res.json()) as { token?: string; expiresIn?: number } };
}

function wsFetch(token?: string) {
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return SELF.fetch(`https://api.test/v1/ws${qs}`, { headers: { Upgrade: "websocket" } });
}

describe("ws-token uitgifte + authz", () => {
  it("ouder krijgt een kortlevend ws-token (60 s)", async () => {
    const fam = await seedFamily("wsp");
    const { status, body } = await mintWsToken(await parentToken(fam.parentId, fam.familyId));
    expect(status).toBe(200);
    expect(body.token).toBeTruthy();
    expect(body.expiresIn).toBe(60);
  });

  it("een ws-token authenticeert geen gewone API-call (401)", async () => {
    const fam = await seedFamily("wsr");
    const { body } = await mintWsToken(await parentToken(fam.parentId, fam.familyId));
    const res = await api("/families/me", { token: body.token! });
    expect(res.status).toBe(401);
  });

  it("kind kan geen ws-token aanvragen (403)", async () => {
    const fam = await seedFamily("wsc");
    const { status } = await mintWsToken(await childToken(fam.childA, fam.familyId));
    expect(status).toBe(403);
  });

  it("ws-token aanvragen zonder auth geeft 401", async () => {
    const res = await api("/ws/token", { method: "POST" });
    expect(res.status).toBe(401);
  });
});

describe("ws-upgrade", () => {
  it("upgrade zonder token geeft 401", async () => {
    const res = await wsFetch();
    expect(res.status).toBe(401);
  });

  it("upgrade met een gewone access-JWT (geen ws-token) geeft 401", async () => {
    const fam = await seedFamily("wsa");
    const res = await wsFetch(await parentToken(fam.parentId, fam.familyId));
    expect(res.status).toBe(401);
  });

  it("geldig ws-token → 101 upgrade en broadcast van instance.updated", async () => {
    const fam = await seedFamily("wsu");
    const taskId = await seedTask(fam.familyId, fam.childA, { points: 15 });
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());

    const { body } = await mintWsToken(await parentToken(fam.parentId, fam.familyId));
    const res = await wsFetch(body.token!);
    expect(res.status).toBe(101);
    const socket = res.webSocket!;
    expect(socket).toBeTruthy();
    socket.accept();

    const received = new Promise<{ event: string; data: { instanceId?: string } }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("geen broadcast ontvangen")), 5000);
      socket.addEventListener("message", (ev) => {
        clearTimeout(timer);
        resolve(JSON.parse(ev.data as string));
      });
    });

    // Mutatie in hetzelfde gezin → de DO broadcast naar de verbonden socket.
    const complete = await api(`/instances/${instanceId}/complete`, {
      method: "POST",
      token: await childToken(fam.childA, fam.familyId),
      idempotencyKey: crypto.randomUUID(),
    });
    expect(complete.status).toBe(200);

    const msg = await received;
    expect(msg.event).toBe("instance.updated");
    expect(msg.data.instanceId).toBe(instanceId);
    socket.close();
  });
});
