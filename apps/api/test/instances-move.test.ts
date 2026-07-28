/**
 * POST /instances/{id}/move — weekplanner instance verplaatsen.
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import {
  seedFamily,
  seedTask,
  seedInstance,
  parentToken,
  childToken,
  api,
  todayAmsterdam,
} from "./helpers";

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function moveInstance(
  token: string,
  instanceId: string,
  body: { date: string; childId: string },
  idempotencyKey = `move-${instanceId}-${body.date}`,
) {
  return api(`/instances/${instanceId}/move`, {
    method: "POST",
    token,
    body,
    idempotencyKey,
  });
}

describe("POST /instances/{id}/move", () => {
  it("verplaatst een open instance naar een andere dag", async () => {
    const fam = await seedFamily("mv1");
    const today = todayAmsterdam();
    const tomorrow = addDays(today, 1);
    const taskId = await seedTask(fam.familyId, fam.childA);
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, today);
    const token = await parentToken(fam.parentId, fam.familyId);

    const res = await moveInstance(token, instanceId, { date: tomorrow, childId: fam.childA });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { date: string; childId: string; status: string };
    expect(body.date).toBe(tomorrow);
    expect(body.childId).toBe(fam.childA);
    expect(body.status).toBe("open");
  });

  it("verplaatst een open instance naar een ander kind", async () => {
    const fam = await seedFamily("mv2");
    const today = todayAmsterdam();
    const taskId = await seedTask(fam.familyId, fam.childA);
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, today);
    const token = await parentToken(fam.parentId, fam.familyId);

    const res = await moveInstance(token, instanceId, { date: today, childId: fam.childB });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { childId: string };
    expect(body.childId).toBe(fam.childB);
  });

  it("weigert een bezette doelslot (409 INSTANCE_SLOT_TAKEN)", async () => {
    const fam = await seedFamily("mv3");
    const today = todayAmsterdam();
    const taskId = await seedTask(fam.familyId, fam.childA);
    const movingId = await seedInstance(fam.familyId, taskId, fam.childA, today);
    await seedInstance(fam.familyId, taskId, fam.childA, addDays(today, 1));
    const token = await parentToken(fam.parentId, fam.familyId);

    const res = await moveInstance(token, movingId, { date: addDays(today, 1), childId: fam.childA });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INSTANCE_SLOT_TAKEN");
  });

  it("weigert verplaatsen van submitted instance (409 INVALID_STATUS)", async () => {
    const fam = await seedFamily("mv4");
    const today = todayAmsterdam();
    const taskId = await seedTask(fam.familyId, fam.childA);
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, today);
    await env.DB
      .prepare("UPDATE task_instances SET status = 'submitted' WHERE id = ?")
      .bind(instanceId)
      .run();
    const token = await parentToken(fam.parentId, fam.familyId);

    const res = await moveInstance(token, instanceId, { date: addDays(today, 1), childId: fam.childA });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_STATUS");
  });

  it("weigert verplaatsen naar het verleden (400)", async () => {
    const fam = await seedFamily("mv5");
    const today = todayAmsterdam();
    const taskId = await seedTask(fam.familyId, fam.childA);
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, today);
    const token = await parentToken(fam.parentId, fam.familyId);

    const res = await moveInstance(token, instanceId, {
      date: addDays(today, -1),
      childId: fam.childA,
    });
    expect(res.status).toBe(400);
  });

  it("kind mag niet verplaatsen (403)", async () => {
    const fam = await seedFamily("mv6");
    const today = todayAmsterdam();
    const taskId = await seedTask(fam.familyId, fam.childA);
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, today);

    const res = await moveInstance(
      await childToken(fam.childA, fam.familyId),
      instanceId,
      { date: addDays(today, 1), childId: fam.childA },
    );
    expect(res.status).toBe(403);
  });

  it("approve_only-ouder mag niet verplaatsen (403)", async () => {
    const fam = await seedFamily("mv7");
    const today = todayAmsterdam();
    const taskId = await seedTask(fam.familyId, fam.childA);
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, today);

    const res = await moveInstance(
      await parentToken(fam.parentId, fam.familyId, { perm: "approve_only" }),
      instanceId,
      { date: addDays(today, 1), childId: fam.childA },
    );
    expect(res.status).toBe(403);
  });

  it("idempotency replay geeft dezelfde response", async () => {
    const fam = await seedFamily("mv8");
    const today = todayAmsterdam();
    const tomorrow = addDays(today, 1);
    const taskId = await seedTask(fam.familyId, fam.childA);
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, today);
    const token = await parentToken(fam.parentId, fam.familyId);
    const key = "idem-move-test";

    const first = await moveInstance(token, instanceId, { date: tomorrow, childId: fam.childA }, key);
    const second = await moveInstance(token, instanceId, { date: tomorrow, childId: fam.childA }, key);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers.get("Idempotent-Replay")).toBe("true");
  });
});
