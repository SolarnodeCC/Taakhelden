import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import tailwindConfig from "../tailwind.config";

/**
 * Guards the two design-system contracts that fail silently.
 *
 * Both defects this covers shipped unnoticed because neither is visible in
 * review: a token that looks like a fine teal but measures 3.30:1, and a
 * `fontSize` map that looks correct but drops every line-height. Assertions are
 * cheaper than another audit.
 */

const css = readFileSync(
  fileURLToPath(new URL("../app/globals.css", import.meta.url)),
  "utf8",
);

function token(name: string): string {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m?.[1]) throw new Error(`token --${name} not found in globals.css`);
  return m[1];
}

/** WCAG 2.1 relative luminance (sRGB). */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Flatten an alpha-composited colour so tinted fills can be measured. */
function over(fg: string, bg: string, alpha: number): string {
  const f = parseInt(fg.slice(1), 16);
  const b = parseInt(bg.slice(1), 16);
  const mix = (shift: number) =>
    Math.round((((f >> shift) & 255) * alpha + ((b >> shift) & 255) * (1 - alpha)))
      .toString(16)
      .padStart(2, "0");
  return `#${mix(16)}${mix(8)}${mix(0)}`;
}

const AA_TEXT = 4.5; // WCAG 1.4.3
const AA_NON_TEXT = 3; // WCAG 1.4.11

describe("colour tokens meet WCAG 2.1 AA", () => {
  const bg = token("color-bg");
  const surface = token("color-surface");

  it.each([
    ["white on accent (primary button)", () => contrast(token("color-on-accent"), token("color-accent"))],
    ["accent on bg (links, active nav)", () => contrast(token("color-accent"), bg)],
    ["accent on surface (sidebar)", () => contrast(token("color-accent"), surface)],
    ["white on accent-hover", () => contrast(token("color-on-accent"), token("color-accent-hover"))],
    ["muted on bg", () => contrast(token("color-text-muted"), bg)],
    ["muted on surface", () => contrast(token("color-text-muted"), surface)],
    ["text on bg", () => contrast(token("color-text"), bg)],
    ["danger on danger-bg", () => contrast(token("color-danger"), token("color-danger-bg"))],
    ["white on danger (danger button)", () => contrast(token("color-on-accent"), token("color-danger"))],
    ["success-text on success-bg", () => contrast(token("color-success-text"), token("color-success-bg"))],
    ["kid-coral-text on kid-coral-soft", () => contrast(token("kid-coral-text"), token("kid-coral-soft"))],
    ["kid-yellow-text on kid-yellow-soft", () => contrast(token("kid-yellow-text"), token("kid-yellow-soft"))],
  ])("%s clears 4.5:1", (_label, ratio) => {
    expect(ratio()).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("accent-on-tint is readable on the accent/10 chip over both backgrounds", () => {
    const fg = token("color-accent-on-tint");
    const decorative = token("color-accent-decorative");
    expect(contrast(fg, over(decorative, bg, 0.1))).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(fg, over(decorative, surface, 0.1))).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(fg, token("kid-turquoise-soft"))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("interactive borders are perceivable on both surfaces", () => {
    const border = token("color-border-interactive");
    expect(contrast(border, bg)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrast(border, surface)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it("the focus ring is perceivable wherever it lands", () => {
    const ring = token("color-accent");
    expect(contrast(ring, bg)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrast(ring, surface)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it("the decorative accent stays out of text roles but still passes 3:1", () => {
    // Kept deliberately: it is the brand teal for marks and fills, and at
    // 3.3:1 it would fail as text — which is why it has its own token.
    const decorative = token("color-accent-decorative");
    expect(contrast(decorative, bg)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrast(decorative, bg)).toBeLessThan(AA_TEXT);
  });
});

describe("type scale ships line-heights", () => {
  // A bare string here emits `font-size` only and silently discards Tailwind's
  // paired defaults, dropping all body copy to the UA's `normal` (~1.2).
  const fontSize = tailwindConfig.theme?.extend?.fontSize as Record<string, unknown>;

  it("defines every step as a [size, { lineHeight }] pair", () => {
    expect(Object.keys(fontSize).length).toBeGreaterThan(0);
    for (const [step, value] of Object.entries(fontSize)) {
      expect(Array.isArray(value), `text-${step} must pair a line-height`).toBe(true);
      const [size, opts] = value as [string, { lineHeight?: string }];
      expect(size).toMatch(/^var\(--text-/);
      expect(opts?.lineHeight, `text-${step} is missing lineHeight`).toBeTruthy();
    }
  });

  it("keeps body steps loose enough to read", () => {
    for (const step of ["xs", "sm", "base"]) {
      const [, opts] = fontSize[step] as [string, { lineHeight: string }];
      const resolved = opts.lineHeight.startsWith("var(")
        ? Number(/--leading-normal:\s*([\d.]+)/.exec(css)?.[1])
        : Number(opts.lineHeight);
      expect(resolved, `text-${step} line-height`).toBeGreaterThanOrEqual(1.5);
    }
  });
});
