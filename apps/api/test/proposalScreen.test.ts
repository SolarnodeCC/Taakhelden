/**
 * WS-AI-GUARD (ADR-0006) fase 1 — pure-function tests voor de deterministische
 * screening, los van de route/authz-laag (die dekt `proposals.test.ts`).
 */
import { describe, it, expect } from "vitest";
import { screenProposalText } from "../src/services/proposalScreen";

describe("screenProposalText", () => {
  it("laat gewone taakvraag-tekst ongemarkeerd", () => {
    expect(screenProposalText("Auto wassen", "Ik wil sparen voor de bioscoop")).toBeNull();
    expect(screenProposalText("Hond uitlaten", null)).toBeNull();
    expect(screenProposalText("Kamer opruimen", undefined)).toBeNull();
  });

  it("markeert een titel of note met een zorgwekkend woord", () => {
    expect(screenProposalText("Werkstuk over drugs", null)).toBe("language");
    expect(screenProposalText("Auto wassen", "hij had een wapen bij zich, best eng")).toBe(
      "language",
    );
  });

  it("respecteert woordgrenzen — geen false positive op substrings", () => {
    // "hamster" bevat geen los woord uit de lijst.
    expect(screenProposalText("Hamsterkooi schoonmaken", null)).toBeNull();
    // "seksualiteit" is expliciet uitgesloten (voorlichting is geen zorgsignaal).
    expect(screenProposalText("Werkstuk over seksualiteit", null)).toBeNull();
  });

  it("is hoofdletterongevoelig", () => {
    expect(screenProposalText("WERKSTUK OVER DRUGS", null)).toBe("language");
  });
});
