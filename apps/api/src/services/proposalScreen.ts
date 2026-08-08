/**
 * WS-AI-GUARD fase 1 (ADR-0006) — deterministische veiligheidsvlag op de
 * vrije tekst van een Taakvraag (title/note). Geen model-call, geen I/O: dit
 * is de enige plek in het productpad waar een kind vrije tekst instuurt, dus
 * de screening moet zonder latency en zonder externe afhankelijkheid werken.
 *
 * Het is een signaal voor de OUDER, geen filter voor het kind: de taakvraag
 * wordt altijd aangemaakt (`routes/proposals.ts` blokkeert nooit op basis van
 * deze vlag). Fase 2 (een classifier-model) komt er pas bij als een
 * Nederlandse eval-set aantoont dat hij beter is dan deze lijst — zie
 * `docs/wispel-ai-workstreams.md` §5.
 */

/** Vlagcodes; NULL/geen match = geen vlag. Eén code vandaag, ruimte voor meer zonder migratie. */
export type ProposalReviewFlag = "language";

// Bewust kort en specifiek op mogelijke veiligheidszorgen (zelfbeschadiging,
// geweld, seksueel, middelen) — geen brede scheldwoordenfilter. Een taakvraag
// met een scheldwoord is vervelend maar geen reden voor een ouder-alert; een
// signaal van zelfbeschadiging wel. Woordgrenzen via \b voorkomen false
// positives op substrings (bv. "hamster" bevat geen woord uit de lijst, maar
// laat "mes" niet los matchen op een langer woord).
const CONCERN_PATTERN =
  /\b(zelfmoord|zelfdoding|snijden|automutilatie|dood ?gaan|niet meer leven|drugs|wiet|xtc|porno|seks(?!ualiteit)|geweld|vermoorden|neersteken|wapen)\b/i;

/**
 * Screent de vrije tekst van een taakvraag. Pure functie, geen I/O — mag
 * synchroon in het request-pad draaien zonder de latency-eisen van AI-4 te
 * raken (er is hier geen model).
 */
export function screenProposalText(title: string, note: string | null | undefined): ProposalReviewFlag | null {
  const combined = `${title} ${note ?? ""}`;
  return CONCERN_PATTERN.test(combined) ? "language" : null;
}
