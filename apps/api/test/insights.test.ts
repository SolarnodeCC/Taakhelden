/**
 * WS-INSIGHTS: GET /families/me/insights — authz + reconciliation tests.
 *
 * Dekt:
 *  - 200 voor ouder, 403 voor kind
 *  - Cross-family isolatie
 *  - earned - spent == net (reconciliation)
 *  - slippingTasks bevat alleen tasks met open/open_redo status
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
import { weekDates } from "../src/services/time";
import type { WeeklyInsightsResponse } from "@taakhelden/shared";

const TODAY = todayAmsterdam();
const WEEK_OF = weekDates(TODAY)[0]!; // maandag van deze week

/** Boek een ledger-entry rechtstreeks in D1 (test-helper). */
async function seedLedgerEntry(
  familyId: string,
  childId: string,
  type: string,
  amount: number,
) {
  await env.DB
    .prepare(
      `INSERT INTO points_ledger (id, family_id, child_id, type, amount)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(`pl_ins${Math.random().toString(36).slice(2)}`, familyId, childId, type, amount)
    .run();
}

describe("GET /families/me/insights — authz", () => {
  it("kind krijgt 403", async () => {
    const fam = await seedFamily("ins_child");
    const res = await api(`/families/me/insights?weekOf=${WEEK_OF}`, {
      token: await childToken(fam.childA, fam.familyId),
    });
    expect(res.status).toBe(403);
  });

  it("ouder krijgt 200 met juiste structuur", async () => {
    const fam = await seedFamily("ins_parent");
    const res = await api(`/families/me/insights?weekOf=${WEEK_OF}`, {
      token: await parentToken(fam.parentId, fam.familyId),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as WeeklyInsightsResponse;
    expect(body.weekOf).toBe(WEEK_OF);
    expect(body.range).toBe("week");
    expect(Array.isArray(body.children)).toBe(true);
    // Twee kinderen verwacht
    expect(body.children).toHaveLength(2);
    for (const child of body.children) {
      expect(typeof child.childId).toBe("string");
      expect(typeof child.displayName).toBe("string");
      expect(child.earned).toBeGreaterThanOrEqual(0);
      expect(child.spent).toBeGreaterThanOrEqual(0);
      expect(child.net).toBe(child.earned - child.spent);
    }
  });
});

describe("GET /families/me/insights — cross-family isolatie", () => {
  it("ouder van gezin A ziet geen kinderen van gezin B", async () => {
    const famA = await seedFamily("ins_iso_a");
    const famB = await seedFamily("ins_iso_b");

    // Voeg een ledger-entry toe voor kind B
    await seedLedgerEntry(famB.familyId, famB.childA, "task", 50);

    const res = await api(`/families/me/insights?weekOf=${WEEK_OF}`, {
      token: await parentToken(famA.parentId, famA.familyId),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as WeeklyInsightsResponse;
    const childIds = body.children.map((c) => c.childId);
    expect(childIds).not.toContain(famB.childA);
    expect(childIds).not.toContain(famB.childB);
    // earned van gezin A is 0 (geen eigen entries)
    for (const child of body.children) {
      expect(child.earned).toBe(0);
    }
  });
});

describe("GET /families/me/insights — earned-spent=net reconciliation", () => {
  it("earned - spent == net en net klopt met saldo van de week", async () => {
    const fam = await seedFamily("ins_rec");
    const childId = fam.childA;
    const familyId = fam.familyId;

    // Directe ledger-entries die binnen de week vallen (today is in de week)
    await seedLedgerEntry(familyId, childId, "task", 30);
    await seedLedgerEntry(familyId, childId, "task", 20);
    await seedLedgerEntry(familyId, childId, "redemption", -15);

    const res = await api(`/families/me/insights?weekOf=${WEEK_OF}`, {
      token: await parentToken(fam.parentId, familyId),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as WeeklyInsightsResponse;
    const child = body.children.find((c) => c.childId === childId);
    expect(child).toBeDefined();
    expect(child!.earned).toBe(50); // 30 + 20
    expect(child!.spent).toBe(15);  // magnitude van redemption
    expect(child!.net).toBe(35);    // 50 - 15
    expect(child!.net).toBe(child!.earned - child!.spent);
  });

  it("redemption_cancel telt niet als earned", async () => {
    const fam = await seedFamily("ins_cancel");
    const childId = fam.childA;
    const familyId = fam.familyId;

    // redemption_cancel is positief maar mag niet als earned tellen
    await seedLedgerEntry(familyId, childId, "task", 40);
    await seedLedgerEntry(familyId, childId, "redemption", -40);
    await seedLedgerEntry(familyId, childId, "redemption_cancel", 40);

    const res = await api(`/families/me/insights?weekOf=${WEEK_OF}`, {
      token: await parentToken(fam.parentId, familyId),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as WeeklyInsightsResponse;
    const child = body.children.find((c) => c.childId === childId);
    expect(child).toBeDefined();
    expect(child!.earned).toBe(40);  // alleen de task-entry
    expect(child!.spent).toBe(40);   // de redemption
    expect(child!.net).toBe(0);      // 40 - 40 = 0
  });
});

describe("GET /families/me/insights — slippingTasks", () => {
  it("toont taken die open/open_redo bleven; goedgekeurde taken tellen niet mee", async () => {
    const fam = await seedFamily("ins_slip");
    const familyId = fam.familyId;
    const childId = fam.childA;

    const taskA = await seedTask(familyId, childId);
    const taskB = await seedTask(familyId, childId);

    // taskA: 2x open (slipping), taskB: approved (niet slipping)
    const dayInWeek = WEEK_OF; // maandag = in de week
    await seedInstance(familyId, taskA, childId, dayInWeek);
    await seedInstance(familyId, taskA, childId, weekDates(WEEK_OF)[1]!); // dinsdag

    const approvInst = await seedInstance(familyId, taskB, childId, dayInWeek);
    await env.DB
      .prepare("UPDATE task_instances SET status = 'approved' WHERE id = ?")
      .bind(approvInst)
      .run();

    const res = await api(`/families/me/insights?weekOf=${WEEK_OF}`, {
      token: await parentToken(fam.parentId, familyId),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as WeeklyInsightsResponse;
    const child = body.children.find((c) => c.childId === childId);
    expect(child).toBeDefined();
    const slipping = child!.slippingTasks;
    expect(slipping.some((t) => t.taskId === taskA)).toBe(true);
    expect(slipping.some((t) => t.taskId === taskB)).toBe(false);
  });
});

describe("GET /families/me/insights — childId filter", () => {
  it("filtereren op childId geeft alleen dat kind terug", async () => {
    const fam = await seedFamily("ins_filter");
    const res = await api(
      `/families/me/insights?weekOf=${WEEK_OF}&childId=${fam.childA}`,
      { token: await parentToken(fam.parentId, fam.familyId) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as WeeklyInsightsResponse;
    expect(body.children).toHaveLength(1);
    expect(body.children[0]!.childId).toBe(fam.childA);
  });

  it("childId van een ander gezin geeft leeg resultaat terug (geen data-leak)", async () => {
    const famA = await seedFamily("ins_fil_a");
    const famB = await seedFamily("ins_fil_b");

    const res = await api(
      `/families/me/insights?weekOf=${WEEK_OF}&childId=${famB.childA}`,
      { token: await parentToken(famA.parentId, famA.familyId) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as WeeklyInsightsResponse;
    // childId B hoort niet bij familyId A → lege children-lijst
    expect(body.children).toHaveLength(0);
  });
});
