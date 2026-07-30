---
name: design-system
description: Bouwt of wijzigt user-facing UI in Wispel volgens het design system — juiste register (ouder-dashboard/kind/teen), token-variabelen i.p.v. ruwe hex/px, en herbruik van de bestaande primitives. Gebruik bij "UI", "component", "styling", "pagina/scherm bouwen", "design", of het aanpassen van een bestaande view.
---

# Design system

Gebruik dit playbook bij elk stukje user-facing UI. De bron van waarheid is de
**`Design System/`**-map in de repo-root; deze skill is de brug naar onze eigen
conventies (Tailwind-token-utilities in `apps/web`).

Brand sheet: [`docs/brand/wispel-brand-v1.md`](../../../docs/brand/wispel-brand-v1.md).

> Concrete token-namen, kleur-hexen en het component-overzicht staan in
> [`references/tokens.md`](references/tokens.md) — lees dat bestand pas wanneer je
> gaat bouwen (progressive disclosure), niet op voorhand. De volledige rationale
> staat in `Design System/readme.md`.

## 1. Kies het register
Eén token-set, twee (drie) registers — kies bewust:
- **Ouder-dashboard** (`apps/web`) — kalm/neutraal: wit/`surface`, één teal `accent`,
  1px `border`, vlakke `shadow-sm`, `system-ui`. Geen illustratie, geen emoji in chrome.
- **Kind-app** (iOS, toekomstig) — warm/rond: koraal/turquoise/geel op crème, grote
  radii (`rounded-xl`), `font-rounded`, warme `shadow-kid`, emoji als iconen.
- **Teen mode** — gedempt: navy/mint, minder emoji en ornament.

## 2. Gebruik tokens, nooit ruwe waarden
- Kleuren/spacing/radii/schaduw via Tailwind-utilities die op de CSS-variabelen
  mappen (`bg-accent`, `text-muted`, `rounded-xl`, `shadow-kid`, `bg-kid-coral`).
- **Nooit** een ruwe hex (`#0e9f8e`) of harde px voor tokens die al bestaan.
- Token-bron: `apps/web/app/globals.css` (gespiegeld in `Design System/tokens/`).
  Nieuw token nodig? Voeg het op **beide** plekken identiek toe.
- Kid/teen-paletten zijn **shipping brand v1** — zie `docs/brand/wispel-brand-v1.md`.
  Wijzig hex alleen via de token-owner (O17).

## 3. Herbruik de primitives
- Web-primitives leven in `apps/web/components/ui/` (`Button`, `ButtonLink`, `Card`,
  `Field`/`Input`, `Badge`, `Alert`, `ProgressBar`, plus kid-varianten).
- Brand: `apps/web/components/brand/` (`WispelMark`, `WispelWordmark`, `NavIcon`).
- Ontbreekt een primitive? Kijk eerst of `Design System/components/` er al één heeft en
  port die naar de Tailwind-token-conventie; verzin geen nieuwe stijl.

## 4. Copy & toegankelijkheid
- Gebruikersgerichte strings: Nederlands via `apps/web/messages/{nl,en}.json` — voeg
  beide talen toe. Kindgerichte tekst: positieve toon (`@dutch-child-copy`, §3.7).
- Productnaam **Wispel**; kindvocabulaire **Ster/Star** — nooit Held/Hero.
- Status nooit alleen op kleur (colorblind-safe): combineer met tekst/icoon/vorm.
- Geen negatieve mechaniek in UI (geen rode kruizen, geen ranglijsten).

## Afronden — verificatie (niet overslaan)
Bevestig met bewijs, ga niet af op aanname:
- [ ] Geen ruwe hex/px waar een token bestaat.
- [ ] Nieuwe/gewijzigde UI importeert primitives uit `apps/web/components/ui/` of `brand/`.
- [ ] Register klopt (dashboard = neutraal/vlak; kid = warm/rond).
- [ ] Nieuwe strings staan in `nl.json` én `en.json`.
- [ ] `npm run typecheck -w apps/web` groen.
- [ ] Diff gecheckt met `/design-check` (`@ui-design-reviewer`).
