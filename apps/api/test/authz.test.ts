/**
 * Fundament van de authz-testsuite (CI verplicht):
 * elke route moet cross-family toegang en rol-overschrijding weigeren.
 */
import { describe, it, expect } from "vitest";
import {
  seedFamily,
  seedTask,
  seedInstance,
  parentToken,
  childToken,
  api,
  todayAmsterdam,
} from "./helpers";

describe("authz-fundament", () => {
  it("kind kan geen taken van een ander kind afvinken (403)", async () => {
    const fam = await seedFamily("a");
    const taskId = await seedTask(fam.familyId, fam.childB);
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childB, todayAmsterdam());

    const res = await api(`/instances/${instanceId}/complete`, {
      method: "POST",
      token: await childToken(fam.childA, fam.familyId),
      idempotencyKey: crypto.randomUUID(),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("kind kan geen taakdefinities aanmaken (403)", async () => {
    const fam = await seedFamily("b");
    const res = await api("/tasks", {
      method: "POST",
      token: await childToken(fam.childA, fam.familyId),
      body: { title: "Stiekem", points: 500, assignees: [fam.childA] },
    });
    expect(res.status).toBe(403);
  });

  it("ouder uit gezin A kan niets van gezin B lezen (404/403)", async () => {
    const famA = await seedFamily("c");
    const famB = await seedFamily("d");
    const taskB = await seedTask(famB.familyId, famB.childA);
    const instanceB = await seedInstance(famB.familyId, taskB, famB.childA, todayAmsterdam());
    const tokenA = await parentToken(famA.parentId, famA.familyId);

    // Instance van gezin B benaderen → bestaat niet binnen gezin A → 404
    const approve = await api(`/instances/${instanceB}/approve`, { method: "POST", token: tokenA });
    expect(approve.status).toBe(404);

    // Taken van gezin B lekken niet in de lijst van gezin A
    const list = await api("/tasks", { token: tokenA });
    expect(list.status).toBe(200);
    const tasks = (await list.json()) as Array<{ id: string }>;
    expect(tasks.some((t) => t.id === taskB)).toBe(false);
  });

  it("approve_only-ouder kan geen instellingen wijzigen (403)", async () => {
    const fam = await seedFamily("e");
    const res = await api("/families/me", {
      method: "PATCH",
      token: await parentToken(fam.parentId, fam.familyId, { perm: "approve_only" }),
      body: { dayBonusPoints: 999 },
    });
    expect(res.status).toBe(403);
  });

  it("verlopen JWT geeft 401 met UNAUTHORIZED-code", async () => {
    const fam = await seedFamily("f");
    const res = await api("/families/me", {
      token: await parentToken(fam.parentId, fam.familyId, { ttl: -10 }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
