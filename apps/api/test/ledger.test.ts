/**
 * GET /points/ledger cursor-afhandeling. Regressie voor F1: een kapotte cursor
 * is een cliëntfout (400 VALIDATION_FAILED), nooit een ongevangen 500.
 */
import { describe, it, expect } from "vitest";
import { seedFamily, childToken, api } from "./helpers";

describe("GET /points/ledger — cursor", () => {
  it("kapotte cursor (geen base64/JSON) → 400, niet 500", async () => {
    const { familyId, childA } = await seedFamily("cur");
    const token = await childToken(childA, familyId);

    const res = await api(`/points/ledger?cursor=%%%not-base64%%%`, { token });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("geldige base64 met verkeerde vorm → 400", async () => {
    const { familyId, childA } = await seedFamily("cur");
    const token = await childToken(childA, familyId);

    // Geldige base64/JSON, maar mist createdAt/id.
    const cursor = btoa(JSON.stringify({ foo: "bar" }));
    const res = await api(`/points/ledger?cursor=${encodeURIComponent(cursor)}`, { token });

    expect(res.status).toBe(400);
  });

  it("zonder cursor → 200 met lege eerste pagina", async () => {
    const { familyId, childA } = await seedFamily("cur");
    const token = await childToken(childA, familyId);

    const res = await api(`/points/ledger`, { token });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: unknown[]; nextCursor: string | null };
    expect(Array.isArray(body.entries)).toBe(true);
    expect(body.nextCursor).toBeNull();
  });
});
