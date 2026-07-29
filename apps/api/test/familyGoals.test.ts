import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { api, childToken, parentToken, seedFamily } from "./helpers";

describe("phase3-family-goals-authz", () => {
  it("ouder maakt gezinsdoel; kind ziet progress zonder sibling-ranking", async () => {
    const fam = await seedFamily("fg");
    const parent = await parentToken(fam.parentId, fam.familyId);

    const create = await api("/families/me/goals", {
      method: "POST",
      token: parent,
      idempotencyKey: "fg-create",
      body: {
        title: "Samen pizza-avond",
        icon: "🍕",
        targetPoints: 100,
        childIds: [],
      },
    });
    expect(create.status).toBe(201);
    const goal = await create.json<{ id: string; targetPoints: number }>();
    expect(goal.targetPoints).toBe(100);

    await env.DB.batch([
      env.DB
        .prepare(
          `INSERT INTO points_ledger (id, family_id, child_id, type, amount)
           VALUES ('pl_fg1', ?, ?, 'task', 40)`,
        )
        .bind(fam.familyId, fam.childA),
      env.DB
        .prepare(
          `INSERT INTO points_ledger (id, family_id, child_id, type, amount)
           VALUES ('pl_fg2', ?, ?, 'task', 35)`,
        )
        .bind(fam.familyId, fam.childB),
    ]);

    const child = await childToken(fam.childA, fam.familyId);
    const progress = await api("/families/me/goals/active/progress", { token: child });
    expect(progress.status).toBe(200);
    const body = await progress.json<{
      progress: { earnedPoints: number; targetPoints: number; title: string } | null;
    }>();
    expect(body.progress).not.toBeNull();
    expect(body.progress!.earnedPoints).toBe(75);
    expect(body.progress!.targetPoints).toBe(100);
    // Geen per-kind breakdown of namen in de progress-response.
    expect(body.progress).not.toHaveProperty("childIds");
    expect(JSON.stringify(body)).not.toMatch(/"childId"|Noor/);
  });

  it("kind mag geen gezinsdoel aanmaken", async () => {
    const fam = await seedFamily("fgc");
    const token = await childToken(fam.childA, fam.familyId);
    const res = await api("/families/me/goals", {
      method: "POST",
      token,
      idempotencyKey: "fg-child",
      body: { title: "Nee", icon: "🎯", targetPoints: 50 },
    });
    expect(res.status).toBe(403);
  });

  it("max één actief doel; cross-family isolatie", async () => {
    const famA = await seedFamily("fga");
    const famB = await seedFamily("fgb");
    const parentA = await parentToken(famA.parentId, famA.familyId);
    const parentB = await parentToken(famB.parentId, famB.familyId);

    const first = await api("/families/me/goals", {
      method: "POST",
      token: parentA,
      idempotencyKey: "fg-a1",
      body: { title: "Doel A", targetPoints: 50 },
    });
    expect(first.status).toBe(201);
    const goalA = await first.json<{ id: string }>();

    const second = await api("/families/me/goals", {
      method: "POST",
      token: parentA,
      idempotencyKey: "fg-a2",
      body: { title: "Nog een", targetPoints: 50 },
    });
    expect(second.status).toBe(409);

    const leak = await api(`/families/me/goals/${goalA.id}`, { token: parentB });
    expect(leak.status).toBe(404);
  });
});
