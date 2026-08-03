/**
 * Regressietest voor audit-bevinding 10: CSRF-verdediging in de diepte op de
 * BFF. De proxy authenticeert puur op het `th_at`-cookie, dus `SameSite=lax`
 * mag niet het enige zijn dat een cross-site mutatie tegenhoudt.
 */
import { describe, expect, it } from "vitest";
import { crossOriginBlock } from "./config";

const post = (origin?: string, url = "https://app.wispel.cc/api/v1/members") =>
  new Request(url, {
    method: "POST",
    headers: origin ? { Origin: origin } : undefined,
  });

describe("crossOriginBlock", () => {
  it("blokkeert een mutatie vanaf een andere origin", () => {
    const res = crossOriginBlock(post("https://evil.example"));
    expect(res?.status).toBe(403);
  });

  it("laat een same-origin mutatie door", () => {
    expect(crossOriginBlock(post("https://app.wispel.cc"))).toBeNull();
  });

  it("laat een mutatie zonder Origin-header door", () => {
    // Niet-browserclients sturen geen Origin; voor browsers dekt SameSite dat af.
    expect(crossOriginBlock(post())).toBeNull();
  });

  it("blokkeert nooit veilige methodes", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const req = new Request("https://app.wispel.cc/api/v1/members", {
        method,
        headers: { Origin: "https://evil.example" },
      });
      expect(crossOriginBlock(req)).toBeNull();
    }
  });

  it("onderscheidt een origin die alleen als prefix lijkt te kloppen", () => {
    const res = crossOriginBlock(post("https://app.wispel.cc.evil.example"));
    expect(res?.status).toBe(403);
  });
});
