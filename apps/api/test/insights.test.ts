/**
 * Ouder-inzichten: verdiend/uitgegeven per kind, weektrend en blijvend-open taken.
 * Read-only en ouder-only (kind → 403; ander gezin onzichtbaar).
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { seedFamily, seedTask, seedInstance, parentToken, childToken, api, todayAmsterdam } from "./helpers";

async function seedLedger(familyId: string, childId: string, type: string, amount: number) {
  await env.DB
    .prepare(
      "INSERT INTO points_ledger (id, family_id, child_id, type, amount) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(`pl_ins${crypto.randomUUID().slice(0, 8)}`, familyId, childId, type, amount)
    .run();
}

describe("GET /insights", () => {
  it("ouder krijgt verdiend/uitgegeven, saldo en blijvend-open taken", async () => {
    const fam = await seedFamily("ins");
    // childA: 30 (taak) + 10 (dagbonus) verdiend − 25 (inlossing) = saldo 15
    await seedLedger(fam.familyId, fam.childA, "task", 30);
    await seedLedger(fam.familyId, fam.childA, "day_bonus", 10);
    await seedLedger(fam.familyId, fam.childA, "redemption", -25);

    // Een taak die blijft liggen: één open instance van vandaag.
    const taskId = await seedTask(fam.familyId, fam.childA, { points: 15 });
    await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());

    const res = await api("/insights", { token: await parentToken(fam.parentId, fam.familyId) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      from: string;
      children: Array<{ childId: string; earned: number; spent: number; balance: number; weekly: unknown[] }>;
      tasksNeedingAttention: Array<{ taskId: string; open: number; completionRate: number }>;
    };

    const childA = body.children.find((c) => c.childId === fam.childA)!;
    expect(childA.earned).toBe(40);
    expect(childA.spent).toBe(25);
    expect(childA.balance).toBe(15);
    expect(childA.weekly.length).toBeGreaterThanOrEqual(1);

    // Beide kinderen komen voor (childB zonder ledger → nullen).
    expect(body.children.length).toBe(2);
    const childB = body.children.find((c) => c.childId === fam.childB)!;
    expect(childB.balance).toBe(0);

    const attn = body.tasksNeedingAttention.find((t) => t.taskId === taskId)!;
    expect(attn.open).toBe(1);
    expect(attn.completionRate).toBe(0);
  });

  it("kind mag geen inzichten opvragen (403)", async () => {
    const fam = await seedFamily("insx");
    const res = await api("/insights", { token: await childToken(fam.childA, fam.familyId) });
    expect(res.status).toBe(403);
  });

  it("cross-family: inzichten tonen alleen het eigen gezin", async () => {
    const famA = await seedFamily("insa");
    const famB = await seedFamily("insb");
    await seedLedger(famB.familyId, famB.childA, "task", 99);

    const res = await api("/insights", { token: await parentToken(famA.parentId, famA.familyId) });
    const body = (await res.json()) as { children: Array<{ childId: string }> };
    expect(body.children.every((c) => c.childId !== famB.childA)).toBe(true);
    expect(body.children.length).toBe(2);
  });
});
