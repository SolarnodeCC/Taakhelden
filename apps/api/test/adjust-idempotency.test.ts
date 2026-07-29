/**
 * POST /points/adjust — Idempotency-Key verplicht (architectuurregel 2).
 * Zonder key: dubbele retries zouden punten dubbel kunnen bijboeken.
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { seedFamily, parentToken, childToken, api } from "./helpers";

describe("POST /points/adjust — idempotency", () => {
  it("zonder Idempotency-Key → 400", async () => {
    const fam = await seedFamily("adj");
    const token = await parentToken(fam.parentId, fam.familyId);
    const res = await api("/points/adjust", {
      method: "POST",
      token,
      body: { childId: fam.childA, amount: 10, note: "Bonus" },
    });
    expect(res.status).toBe(400);
  });

  it("zelfde key → één boeking; replay geeft Idempotent-Replay", async () => {
    const fam = await seedFamily("adj2");
    const token = await parentToken(fam.parentId, fam.familyId);
    const key = crypto.randomUUID();
    const body = { childId: fam.childA, amount: 15, note: "Extra" };

    const first = await api("/points/adjust", {
      method: "POST",
      token,
      idempotencyKey: key,
      body,
    });
    expect(first.status).toBe(200);
    const balance1 = ((await first.json()) as { newBalance: number }).newBalance;
    expect(balance1).toBe(15);

    const replay = await api("/points/adjust", {
      method: "POST",
      token,
      idempotencyKey: key,
      body,
    });
    expect(replay.status).toBe(200);
    expect(replay.headers.get("Idempotent-Replay")).toBe("true");
    expect(((await replay.json()) as { newBalance: number }).newBalance).toBe(15);

    const sum = await env.DB.prepare(
      "SELECT COALESCE(SUM(amount),0) AS s FROM points_ledger WHERE family_id = ? AND child_id = ?",
    )
      .bind(fam.familyId, fam.childA)
      .first<{ s: number }>();
    expect(sum?.s).toBe(15);
  });

  it("kind mag niet bijboeken", async () => {
    const fam = await seedFamily("adj3");
    const token = await childToken(fam.childA, fam.familyId);
    const res = await api("/points/adjust", {
      method: "POST",
      token,
      idempotencyKey: crypto.randomUUID(),
      body: { childId: fam.childA, amount: 5, note: "Nope" },
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /health", () => {
  it("returns ok+db without disclosing jwt config", async () => {
    const res = await api("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.db).toBe(true);
    expect(body).not.toHaveProperty("jwt");
  });
});
