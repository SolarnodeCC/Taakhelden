/**
 * Badges (API-spec §3.9): server-side toekenning in de complete-transactie,
 * GET /badges met verdien-status, en de authz-grenzen.
 */
import { describe, it, expect } from "vitest";
import { seedFamily, seedTask, seedInstance, parentToken, childToken, api, todayAmsterdam } from "./helpers";

type Badge = { id: string; title: string; icon: string };
type BadgesBody = { childId: string; badges: Array<Badge & { earned: boolean; earnedAt: string | null }> };

async function complete(familyId: string, childId: string) {
  const taskId = await seedTask(familyId, childId, { points: 15 });
  const instanceId = await seedInstance(familyId, taskId, childId, todayAmsterdam());
  const res = await api(`/instances/${instanceId}/complete`, {
    method: "POST",
    token: await childToken(childId, familyId),
    idempotencyKey: crypto.randomUUID(),
  });
  return res.json() as Promise<{ newBadges: Badge[] }>;
}

describe("badge-toekenning", () => {
  it("eerste afgeronde taak levert de 'first_task'-badge op", async () => {
    const fam = await seedFamily("bdg");
    const { newBadges } = await complete(fam.familyId, fam.childA);
    expect(newBadges.map((b) => b.id)).toContain("first_task");
    const first = newBadges.find((b) => b.id === "first_task")!;
    expect(first.title).toBe("Op weg!");
    expect(first.icon).toBeTruthy();
  });

  it("badge wordt maar één keer toegekend (idempotent)", async () => {
    const fam = await seedFamily("bdi");
    await complete(fam.familyId, fam.childA);
    const second = await complete(fam.familyId, fam.childA);
    expect(second.newBadges.map((b) => b.id)).not.toContain("first_task");
  });

  it("GET /badges toont de catalogus met verdien-status voor het kind", async () => {
    const fam = await seedFamily("bdg2");
    await complete(fam.familyId, fam.childA);

    const res = await api("/badges", { token: await childToken(fam.childA, fam.familyId) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as BadgesBody;
    expect(body.childId).toBe(fam.childA);
    expect(body.badges.length).toBeGreaterThanOrEqual(6);

    const firstTask = body.badges.find((b) => b.id === "first_task")!;
    expect(firstTask.earned).toBe(true);
    expect(firstTask.earnedAt).toBeTruthy();

    // Een niet-verdiende badge staat er wél in, maar als niet-verdiend.
    const homework = body.badges.find((b) => b.id === "homework_hero")!;
    expect(homework.earned).toBe(false);
    expect(homework.earnedAt).toBeNull();
  });

  it("ouder vraagt badges van een specifiek kind op met ?childId=", async () => {
    const fam = await seedFamily("bdgp");
    await complete(fam.familyId, fam.childA);

    const res = await api(`/badges?childId=${fam.childA}`, {
      token: await parentToken(fam.parentId, fam.familyId),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as BadgesBody;
    expect(body.badges.find((b) => b.id === "first_task")!.earned).toBe(true);
  });

  it("ouder zonder ?childId= krijgt 400", async () => {
    const fam = await seedFamily("bdgn");
    const res = await api("/badges", { token: await parentToken(fam.parentId, fam.familyId) });
    expect(res.status).toBe(400);
  });

  it("kind kan de badges van een ander kind niet opvragen (403)", async () => {
    const fam = await seedFamily("bdgx");
    const res = await api(`/badges?childId=${fam.childB}`, {
      token: await childToken(fam.childA, fam.familyId),
    });
    expect(res.status).toBe(403);
  });
});
