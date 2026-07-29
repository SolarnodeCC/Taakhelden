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
    const approve = await api(`/instances/${instanceB}/approve`, {
      method: "POST",
      token: tokenA,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(approve.status).toBe(404);

    // Taken van gezin B lekken niet in de lijst van gezin A
    const list = await api("/tasks", { token: tokenA });
    expect(list.status).toBe(200);
    const tasks = (await list.json()) as Array<{ id: string }>;
    expect(tasks.some((t) => t.id === taskB)).toBe(false);

    // Ook het gegroepeerde vandaag-overzicht blijft strikt binnen gezin A.
    const today = await api("/instances/today", { token: tokenA });
    expect(today.status).toBe(200);
    const overview = (await today.json()) as {
      children: Array<{ childId: string; instances: Array<{ id: string }> }>;
    };
    expect(overview.children.map((child) => child.childId).sort()).toEqual(
      [famA.childA, famA.childB].sort(),
    );
    expect(
      overview.children.flatMap((child) => child.instances).some((instance) => instance.id === instanceB),
    ).toBe(false);
  });

  it("kind ziet in /instances/today alleen de eigen taken en balans", async () => {
    const fam = await seedFamily("today");
    const ownTask = await seedTask(fam.familyId, fam.childA);
    const siblingTask = await seedTask(fam.familyId, fam.childB);
    const ownInstance = await seedInstance(fam.familyId, ownTask, fam.childA, todayAmsterdam());
    const siblingInstance = await seedInstance(fam.familyId, siblingTask, fam.childB, todayAmsterdam());

    const today = await api("/instances/today", {
      token: await childToken(fam.childA, fam.familyId),
    });
    expect(today.status).toBe(200);
    const body = (await today.json()) as {
      children?: unknown;
      instances: Array<{ id: string; childId: string }>;
      balance: { childId: string; balance: number };
    };
    expect(body.children).toBeUndefined();
    expect(body.instances).toEqual([
      expect.objectContaining({ id: ownInstance, childId: fam.childA }),
    ]);
    expect(body.instances.some((instance) => instance.id === siblingInstance)).toBe(false);
    expect(body.balance).toMatchObject({ childId: fam.childA, balance: 0 });
  });

  it("v2-contract voegt viewer-discriminator toe zonder sibling-data te lekken", async () => {
    const fam = await seedFamily("todayv2");
    const ownTask = await seedTask(fam.familyId, fam.childA);
    await seedInstance(fam.familyId, ownTask, fam.childA, todayAmsterdam());

    const today = await api("/instances/today", {
      token: await childToken(fam.childA, fam.familyId),
      headers: { "X-Contract-Version": "2" },
    });
    expect(today.status).toBe(200);
    const body = (await today.json()) as {
      viewer: string;
      instances: Array<{ childId: string; photoStatus: string | null }>;
      balance: { childId: string; lifetimeEarned: number };
    };
    expect(body.viewer).toBe("child");
    expect(body.instances.every((instance) => instance.childId === fam.childA)).toBe(true);
    expect(body.instances[0]?.photoStatus ?? null).toBeNull();
    expect(body.balance).toMatchObject({ childId: fam.childA, lifetimeEarned: 0 });
  });

  it("v2-contract voor families/me en points/balance blijft rolbewust", async () => {
    const fam = await seedFamily("familyv2");
    const childTok = await childToken(fam.childA, fam.familyId);
    const parentTok = await parentToken(fam.parentId, fam.familyId);

    const familyChild = await api("/families/me", {
      token: childTok,
      headers: { "X-Contract-Version": "2" },
    });
    expect(familyChild.status).toBe(200);
    expect(((await familyChild.json()) as { viewer: string; inviteCode?: string }).viewer).toBe("child");

    const balanceParent = await api("/points/balance", {
      token: parentTok,
      headers: { "X-Contract-Version": "2" },
    });
    expect(balanceParent.status).toBe(200);
    const parentBody = (await balanceParent.json()) as {
      viewer: string;
      children: Array<{ childId: string; lifetimeEarned: number }>;
    };
    expect(parentBody.viewer).toBe("parent");
    expect(parentBody.children.map((child) => child.childId).sort()).toEqual(
      [fam.childA, fam.childB].sort(),
    );
  });

  it("kind mag alleen eigen redemptions zien en kan geen child device sessions revoken", async () => {
    const fam = await seedFamily("rvk");
    const ownRedemptions = await api("/redemptions", {
      token: await childToken(fam.childA, fam.familyId),
      headers: { "X-Contract-Version": "2" },
    });
    expect(ownRedemptions.status).toBe(200);
    expect(((await ownRedemptions.json()) as { viewer: string }).viewer).toBe("child");

    const siblingList = await api(`/redemptions?childId=${fam.childB}`, {
      token: await childToken(fam.childA, fam.familyId),
    });
    expect(siblingList.status).toBe(403);

    const revoke = await api(`/members/${fam.childA}/device-sessions/revoke`, {
      method: "POST",
      token: await childToken(fam.childA, fam.familyId),
    });
    expect(revoke.status).toBe(403);
  });

  it("ouder kan alleen device sessions van een kind uit het eigen gezin revoken", async () => {
    const famA = await seedFamily("rvka");
    const famB = await seedFamily("rvkb");
    const res = await api(`/members/${famB.childA}/device-sessions/revoke`, {
      method: "POST",
      token: await parentToken(famA.parentId, famA.familyId),
    });
    expect(res.status).toBe(404);
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

  it("POST /sync delta lekt geen instances uit een ander gezin", async () => {
    const famA = await seedFamily("syna");
    const famB = await seedFamily("synb");
    const taskB = await seedTask(famB.familyId, famB.childA);
    const instanceB = await seedInstance(famB.familyId, taskB, famB.childA, todayAmsterdam());

    const completeB = await api(`/instances/${instanceB}/complete`, {
      method: "POST",
      token: await childToken(famB.childA, famB.familyId),
      idempotencyKey: crypto.randomUUID(),
    });
    expect(completeB.status).toBe(200);

    const syncA = await api("/sync", {
      method: "POST",
      token: await childToken(famA.childA, famA.familyId),
      body: { since: "2020-01-01T00:00:00Z", mutations: [] },
    });
    expect(syncA.status).toBe(200);
    const out = (await syncA.json()) as {
      changes: { instances: Array<{ id: string }> };
    };
    expect(out.changes.instances.some((row) => row.id === instanceB)).toBe(false);
  });
});
