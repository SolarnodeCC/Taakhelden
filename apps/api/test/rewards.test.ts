/**
 * Beloningswinkel: kopen → ledger-afboeking, annuleren → tegenboeking,
 * weeklimiet, spaardoel en de authz-grenzen eromheen.
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { seedFamily, parentToken, childToken, api } from "./helpers";
import { localMidnightUtc } from "../src/services/time";
import { countRedemptionsSince } from "../src/repo/rewards";

/** Punten rechtstreeks in het ledger zetten (testopzet, geen saldoveld!). */
async function seedPoints(familyId: string, childId: string, amount: number) {
  await env.DB
    .prepare(
      "INSERT INTO points_ledger (id, family_id, child_id, type, amount) VALUES (?, ?, ?, 'adjustment', ?)",
    )
    .bind(`pl_seed${crypto.randomUUID().slice(0, 8)}`, familyId, childId, amount)
    .run();
}

async function ledgerSum(familyId: string, childId: string) {
  const row = await env.DB
    .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM points_ledger WHERE family_id = ? AND child_id = ?")
    .bind(familyId, childId)
    .first<{ s: number }>();
  return row?.s ?? 0;
}

describe("beloningen: beheer en winkel", () => {
  it("ouder maakt beloning aan; kind ziet de winkel met betaalbaar-markering", async () => {
    const fam = await seedFamily("shop");
    const parentTok = await parentToken(fam.parentId, fam.familyId);

    const created = await api("/rewards", {
      token: parentTok,
      body: { title: "Filmavond kiezen", icon: "movie", price: 100 },
    });
    expect(created.status).toBe(201);
    const reward = (await created.json()) as { id: string; price: number };

    await seedPoints(fam.familyId, fam.childA, 60);
    const shop = await api("/rewards", { token: await childToken(fam.childA, fam.familyId) });
    expect(shop.status).toBe(200);
    const body = (await shop.json()) as {
      balance: number;
      rewards: Array<{ id: string; affordable: boolean }>;
    };
    expect(body.balance).toBe(60);
    expect(body.rewards.find((r) => r.id === reward.id)?.affordable).toBe(false);
  });

  it("kind kan geen beloningen beheren (403)", async () => {
    const fam = await seedFamily("shopz");
    const res = await api("/rewards", {
      token: await childToken(fam.childA, fam.familyId),
      body: { title: "Gratis alles", price: 1 },
    });
    expect(res.status).toBe(403);
  });
});

describe("inlossen: kopen → afboeking → annuleren → terugboeking", () => {
  it("redeem boekt af, is idempotent, en cancel geeft de punten terug", async () => {
    const fam = await seedFamily("rdm");
    const parentTok = await parentToken(fam.parentId, fam.familyId);
    const childTok = await childToken(fam.childA, fam.familyId);

    const created = await api("/rewards", {
      token: parentTok,
      body: { title: "Extra schermtijd", price: 50 },
    });
    const reward = (await created.json()) as { id: string };
    await seedPoints(fam.familyId, fam.childA, 80);

    const key = crypto.randomUUID();
    const redeem = await api(`/rewards/${reward.id}/redeem`, {
      method: "POST",
      token: childTok,
      idempotencyKey: key,
    });
    expect(redeem.status).toBe(200);
    const result = (await redeem.json()) as { redemptionId: string; newBalance: number };
    expect(result.newBalance).toBe(30);

    // Replay: zelfde response, geen tweede afboeking
    const replay = await api(`/rewards/${reward.id}/redeem`, {
      method: "POST",
      token: childTok,
      idempotencyKey: key,
    });
    expect(replay.headers.get("Idempotent-Replay")).toBe("true");
    expect(await ledgerSum(fam.familyId, fam.childA)).toBe(30);

    // Zonder Idempotency-Key mag kopen niet (spec §3.8)
    const zonderKey = await api(`/rewards/${reward.id}/redeem`, { method: "POST", token: childTok });
    expect(zonderKey.status).toBe(400);

    // Ouder ziet de inlossing als pending
    const list = await api("/redemptions?status=pending", { token: parentTok });
    const pending = (await list.json()) as Array<{ id: string }>;
    expect(pending.some((r) => r.id === result.redemptionId)).toBe(true);

    // Annuleren → tegenboeking, saldo terug op 80
    const cancel = await api(`/redemptions/${result.redemptionId}/cancel`, {
      method: "POST",
      token: parentTok,
    });
    expect(cancel.status).toBe(200);
    expect(((await cancel.json()) as { newBalance: number }).newBalance).toBe(80);
    expect(await ledgerSum(fam.familyId, fam.childA)).toBe(80);

    // Nogmaals annuleren → 409, geen dubbele terugboeking
    const dubbel = await api(`/redemptions/${result.redemptionId}/cancel`, {
      method: "POST",
      token: parentTok,
    });
    expect(dubbel.status).toBe(409);
    expect(await ledgerSum(fam.familyId, fam.childA)).toBe(80);
  });

  it("onvoldoende saldo → 409 INSUFFICIENT_POINTS, geen afboeking", async () => {
    const fam = await seedFamily("arm");
    const created = await api("/rewards", {
      token: await parentToken(fam.parentId, fam.familyId),
      body: { title: "IJsje", price: 500 },
    });
    const reward = (await created.json()) as { id: string };
    await seedPoints(fam.familyId, fam.childA, 10);

    const res = await api(`/rewards/${reward.id}/redeem`, {
      method: "POST",
      token: await childToken(fam.childA, fam.familyId),
      idempotencyKey: crypto.randomUUID(),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INSUFFICIENT_POINTS");
    expect(await ledgerSum(fam.familyId, fam.childA)).toBe(10);
  });

  it("weeklimiet: tweede keer kopen deze week → 409 REWARD_LIMIT_REACHED", async () => {
    const fam = await seedFamily("lim");
    const created = await api("/rewards", {
      token: await parentToken(fam.parentId, fam.familyId),
      body: { title: "Uitslapen", price: 10, limitPerWeek: 1 },
    });
    const reward = (await created.json()) as { id: string };
    await seedPoints(fam.familyId, fam.childA, 100);
    const childTok = await childToken(fam.childA, fam.familyId);

    const eerste = await api(`/rewards/${reward.id}/redeem`, {
      method: "POST",
      token: childTok,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(eerste.status).toBe(200);

    const tweede = await api(`/rewards/${reward.id}/redeem`, {
      method: "POST",
      token: childTok,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(tweede.status).toBe(409);
    expect(((await tweede.json()) as { error: { code: string } }).error.code).toBe(
      "REWARD_LIMIT_REACHED",
    );
  });

  it("fulfill: pending → fulfilled, daarna niet nogmaals", async () => {
    const fam = await seedFamily("ful");
    const parentTok = await parentToken(fam.parentId, fam.familyId);
    const created = await api("/rewards", { token: parentTok, body: { title: "Spelletje", price: 20 } });
    const reward = (await created.json()) as { id: string };
    await seedPoints(fam.familyId, fam.childA, 20);

    const redeem = await api(`/rewards/${reward.id}/redeem`, {
      method: "POST",
      token: await childToken(fam.childA, fam.familyId),
      idempotencyKey: crypto.randomUUID(),
    });
    const { redemptionId } = (await redeem.json()) as { redemptionId: string };

    const fulfill = await api(`/redemptions/${redemptionId}/fulfill`, { method: "POST", token: parentTok });
    expect(fulfill.status).toBe(200);
    const again = await api(`/redemptions/${redemptionId}/fulfill`, { method: "POST", token: parentTok });
    expect(again.status).toBe(409);
  });

  it("cross-family: beloning van gezin B is voor gezin A onvindbaar (404)", async () => {
    const famA = await seedFamily("rxa");
    const famB = await seedFamily("rxb");
    const created = await api("/rewards", {
      token: await parentToken(famB.parentId, famB.familyId),
      body: { title: "Geheim", price: 10 },
    });
    const rewardB = (await created.json()) as { id: string };
    await seedPoints(famA.familyId, famA.childA, 100);

    const res = await api(`/rewards/${rewardB.id}/redeem`, {
      method: "POST",
      token: await childToken(famA.childA, famA.familyId),
      idempotencyKey: crypto.randomUUID(),
    });
    expect(res.status).toBe(404);
  });
});

describe("inlossen: idempotentie tegen de dubbel-afboek-race", () => {
  it("twee gelijktijdige redeems met dezelfde Idempotency-Key boeken maar één keer af", async () => {
    const fam = await seedFamily("race");
    const created = await api("/rewards", {
      token: await parentToken(fam.parentId, fam.familyId),
      body: { title: "Schermtijd", price: 50 },
    });
    const reward = (await created.json()) as { id: string };
    await seedPoints(fam.familyId, fam.childA, 80);
    const childTok = await childToken(fam.childA, fam.familyId);
    const key = crypto.randomUUID();

    // Beide requests missen de KV-cache (die schrijft pas ná afloop); alleen de
    // DO-side dedup binnen de geserialiseerde turn voorkomt de tweede afboeking.
    const [a, b] = await Promise.all([
      api(`/rewards/${reward.id}/redeem`, { method: "POST", token: childTok, idempotencyKey: key }),
      api(`/rewards/${reward.id}/redeem`, { method: "POST", token: childTok, idempotencyKey: key }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const ra = (await a.json()) as { redemptionId: string };
    const rb = (await b.json()) as { redemptionId: string };
    expect(rb.redemptionId).toBe(ra.redemptionId);

    // Eén afboeking (80 − 50 = 30) en precies één redemption-rij.
    expect(await ledgerSum(fam.familyId, fam.childA)).toBe(30);
    const rows = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM redemptions WHERE family_id = ? AND child_id = ?")
      .bind(fam.familyId, fam.childA)
      .first<{ n: number }>();
    expect(rows?.n).toBe(1);
  });
});

describe("weeklimiet in gezins-lokale tijd", () => {
  it("localMidnightUtc rekent lokale middernacht naar UTC om", () => {
    expect(localMidnightUtc("Europe/Amsterdam", "2026-07-20")).toBe("2026-07-19 22:00:00"); // CEST (+2)
    expect(localMidnightUtc("Europe/Amsterdam", "2026-01-19")).toBe("2026-01-18 23:00:00"); // CET (+1)
    expect(localMidnightUtc("UTC", "2026-07-20")).toBe("2026-07-20 00:00:00");
  });

  it("telt een inlossing kort na lokale maandag-middernacht mee (UTC-grens)", async () => {
    const fam = await seedFamily("tzlim");
    const rewardId = `rw_tz${crypto.randomUUID().slice(0, 8)}`;
    await env.DB
      .prepare(
        "INSERT INTO rewards (id, family_id, title, icon, price, limit_per_week) VALUES (?, ?, 'Uitslapen', 'sleep', 10, 1)",
      )
      .bind(rewardId, fam.familyId)
      .run();
    // Inlossing op lokale maandag 01:00 Amsterdam (CEST) = 2026-07-19 23:00 UTC —
    // dezelfde week als 2026-07-20, maar vóór lokale middernacht in UTC-tekst.
    await env.DB
      .prepare(
        "INSERT INTO redemptions (id, family_id, reward_id, child_id, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
      )
      .bind(`rd_tz${crypto.randomUUID().slice(0, 8)}`, fam.familyId, rewardId, fam.childA, "2026-07-19 23:00:00")
      .run();

    const sinceUtc = localMidnightUtc("Europe/Amsterdam", "2026-07-20");
    const n = await countRedemptionsSince(env.DB, fam.familyId, fam.childA, rewardId, sinceUtc);
    expect(n).toBe(1); // met de oude UTC/lokaal-vergelijking zou dit ten onrechte 0 zijn
  });
});

describe("spaardoel", () => {
  it("kind pint een beloning en ziet spaarvoortgang in de winkel", async () => {
    const fam = await seedFamily("pin");
    const created = await api("/rewards", {
      token: await parentToken(fam.parentId, fam.familyId),
      body: { title: "Pretpark", price: 200 },
    });
    const reward = (await created.json()) as { id: string };
    await seedPoints(fam.familyId, fam.childA, 50);
    const childTok = await childToken(fam.childA, fam.familyId);

    const pin = await api(`/rewards/${reward.id}/pin`, { method: "POST", token: childTok });
    expect(pin.status).toBe(200);
    expect(((await pin.json()) as { progress: number }).progress).toBe(0.25);

    const shop = await api("/rewards", { token: childTok });
    const body = (await shop.json()) as { savingsGoal: { rewardId: string; progress: number } };
    expect(body.savingsGoal.rewardId).toBe(reward.id);
    expect(body.savingsGoal.progress).toBe(0.25);
  });
});
