import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import nl from "../messages/nl.json";

function leafKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  if (Array.isArray(obj)) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("marketing + legal i18n parity", () => {
  it("nl and en share the same marketing leaf keys", () => {
    const nlKeys = new Set(leafKeys(nl.marketing));
    const enKeys = new Set(leafKeys(en.marketing));
    expect([...nlKeys].sort()).toEqual([...enKeys].sort());
  });

  it("faq and how-it-works array lengths match", () => {
    expect(nl.marketing.faq.items).toHaveLength(en.marketing.faq.items.length);
    expect(nl.marketing.howItWorks.steps).toHaveLength(en.marketing.howItWorks.steps.length);
    expect(nl.marketing.privacy.points).toHaveLength(en.marketing.privacy.points.length);
    expect(nl.marketing.audience.forItems).toHaveLength(en.marketing.audience.forItems.length);
  });

  it("legal privacy/terms section counts match", () => {
    expect(nl.legal.privacy.sections).toHaveLength(en.legal.privacy.sections.length);
    expect(nl.legal.terms.sections).toHaveLength(en.legal.terms.sections.length);
  });

  it("gratis CTA avoids trial/subscription conversion language", () => {
    const banned = [/14.day/i, /proefperiode starten/i, /start.*trial/i, /\$6\.99/];
    const blobs = [
      nl.marketing.ctaPrimary,
      en.marketing.ctaPrimary,
      nl.marketing.gratis.body,
      en.marketing.gratis.body,
    ];
    for (const blob of blobs) {
      for (const re of banned) {
        expect(blob).not.toMatch(re);
      }
    }
  });
});
