/**
 * Offline batch-sync (§3.11): mutaties op volgorde, per-key idempotentie,
 * vriendelijke afwijzing bij conflict, en changes-delta terug.
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { seedFamily, seedTask, seedInstance, seedWeekFiller, childToken, api, todayAmsterdam } from "./helpers";

type InstanceDelta = {
  id: string;
  status: string;
  title: string;
  points: number;
  updatedAt?: string;
};

describe("POST /sync", () => {
  it("past mutaties op volgorde toe en levert een changes-delta", async () => {
    const fam = await seedFamily("syn");
    const taskId = await seedTask(fam.familyId, fam.childA, { points: 15 });
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());
    const token = await childToken(fam.childA, fam.familyId);

    const res = await api("/sync", {
      token,
      body: {
        since: "2020-01-01T00:00:00Z",
        mutations: [{ key: crypto.randomUUID(), op: "complete", instanceId }],
      },
    });
    expect(res.status).toBe(200);
    const out = (await res.json()) as {
      results: Array<{ status: string; points: number }>;
      changes: { ledger: unknown[]; instances: Array<{ id: string; status: string }> };
      serverTime: string;
    };
    expect(out.results[0]!.status).toBe("applied");
    expect(out.results[0]!.points).toBe(15);
    expect(out.changes.instances.find((i) => i.id === instanceId)?.status).toBe("approved");
    expect(out.changes.ledger.length).toBeGreaterThan(0);
    expect(out.serverTime).toBeTruthy();
  });

  it("dezelfde key opnieuw insturen geeft hetzelfde resultaat, geen dubbele punten", async () => {
    const fam = await seedFamily("syni");
    const taskId = await seedTask(fam.familyId, fam.childA, { points: 15 });
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());
    // Nog open taken elders in de week → geen weekbonus door deze ene complete.
    await seedWeekFiller(fam.familyId, taskId, fam.childA, todayAmsterdam(), 4);
    const token = await childToken(fam.childA, fam.familyId);
    const key = crypto.randomUUID();
    const mutations = [{ key, op: "complete", instanceId }];

    const first = await api("/sync", { token, body: { mutations } });
    const firstOut = (await first.json()) as { results: Array<{ status: string }> };
    expect(firstOut.results[0]!.status).toBe("applied");

    // Hele batch nogmaals (netwerk-retry-scenario)
    const second = await api("/sync", { token, body: { mutations } });
    const secondOut = (await second.json()) as { results: Array<{ status: string; points: number }> };
    expect(secondOut.results[0]!.status).toBe("applied");
    expect(secondOut.results[0]!.points).toBe(15);

    const som = await env.DB
      .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM points_ledger WHERE family_id = ? AND child_id = ?")
      .bind(fam.familyId, fam.childA)
      .first<{ s: number }>();
    expect(som?.s).toBe(35); // 15 taak + 20 dagbonus, precies één keer
  });

  it("conflict (redeem zonder saldo) → rejected met code, batch gaat door", async () => {
    const fam = await seedFamily("synr");
    const taskId = await seedTask(fam.familyId, fam.childA, { points: 15 });
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());
    const token = await childToken(fam.childA, fam.familyId);

    const created = await api("/rewards", {
      token: await (await import("./helpers")).parentToken(fam.parentId, fam.familyId),
      body: { title: "Duur", price: 9999 },
    });
    const reward = (await created.json()) as { id: string };

    const res = await api("/sync", {
      token,
      body: {
        mutations: [
          { key: crypto.randomUUID(), op: "complete", instanceId },
          { key: crypto.randomUUID(), op: "redeem", rewardId: reward.id },
        ],
      },
    });
    const out = (await res.json()) as { results: Array<{ status: string; code?: string }> };
    expect(out.results[0]!.status).toBe("applied");
    expect(out.results[1]!.status).toBe("rejected");
    expect(out.results[1]!.code).toBe("INSUFFICIENT_POINTS");
  });

  it("changes.instances heeft de volledige InstanceView-vorm, inclusief updatedAt", async () => {
    const fam = await seedFamily("syncv");
    const taskId = await seedTask(fam.familyId, fam.childA, { points: 15 });
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());
    const token = await childToken(fam.childA, fam.familyId);

    // Zonder `since` (eerste sync na installatie): de volledige dag van vandaag.
    const res = await api("/sync", { token, body: { mutations: [] } });
    const out = (await res.json()) as { changes: { instances: InstanceDelta[] } };
    const view = out.changes.instances.find((i) => i.id === instanceId)!;
    expect(view.title).toBe("Testtaak");
    expect(view.points).toBe(15);
    expect(view.status).toBe("open");
    expect(view.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("met `since` komen alleen instances terug die daarna gewijzigd zijn", async () => {
    const fam = await seedFamily("syncs");
    const today = todayAmsterdam();
    const touchedTask = await seedTask(fam.familyId, fam.childA, { points: 15 });
    const untouchedTask = await seedTask(fam.familyId, fam.childA, { points: 10 });
    const touched = await seedInstance(fam.familyId, touchedTask, fam.childA, today);
    const untouched = await seedInstance(fam.familyId, untouchedTask, fam.childA, today);
    const token = await childToken(fam.childA, fam.familyId);

    // Eerste sync: levert serverTime als watermerk voor de volgende ronde.
    const first = await api("/sync", { token, body: { mutations: [] } });
    const { serverTime } = (await first.json()) as { serverTime: string };
    await new Promise((resolve) => setTimeout(resolve, 20));

    const second = await api("/sync", {
      token,
      body: { since: serverTime, mutations: [{ key: crypto.randomUUID(), op: "complete", instanceId: touched }] },
    });
    const out = (await second.json()) as {
      changes: { instances: InstanceDelta[]; ledger: Array<{ type: string }> };
    };
    const ids = out.changes.instances.map((i) => i.id);
    expect(ids).toContain(touched);
    expect(ids).not.toContain(untouched);
    expect(out.changes.instances.find((i) => i.id === touched)!.status).toBe("approved");
    expect(out.changes.instances.find((i) => i.id === touched)!.updatedAt! > serverTime).toBe(true);
    // Ook de ledger-delta moet de boeking van net teruggeven, ook bij een
    // `since` van enkele milliseconden oud (formaatverschil created_at ↔ ISO).
    expect(out.changes.ledger.map((l) => l.type)).toContain("task");
  });

  it("dubbel afvinken binnen dezelfde batch: tweede wordt vriendelijk afgewezen", async () => {
    const fam = await seedFamily("synd");
    const taskId = await seedTask(fam.familyId, fam.childA, { points: 15 });
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());
    const token = await childToken(fam.childA, fam.familyId);

    const res = await api("/sync", {
      token,
      body: {
        mutations: [
          { key: crypto.randomUUID(), op: "complete", instanceId },
          { key: crypto.randomUUID(), op: "complete", instanceId },
        ],
      },
    });
    const out = (await res.json()) as { results: Array<{ status: string; code?: string }> };
    expect(out.results[0]!.status).toBe("applied");
    expect(out.results[1]!.status).toBe("rejected");
    expect(out.results[1]!.code).toBe("TASK_ALREADY_COMPLETED");
  });
});
