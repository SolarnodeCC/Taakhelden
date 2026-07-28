---
name: test-strategy
description: Gestructureerde testaanpak voor TaakHelden — unit, system en E2E-niveaus, beslisboom per wijziging, en waar welke suite efficiënt draait (lokaal, PR-CI, nightly, release). Gebruik bij nieuwe features, testplanning, CI-ontwerp, of wanneer je moet kiezen welk testniveau je schrijft.
---

# Teststrategie TaakHelden

Dit document is de **centrale bron** voor testniveaus, verantwoordelijkheden en
uitvoeringslocaties. Detail per niveau: [`references/levels.md`](references/levels.md).
Uitvoeringsmatrix (lokaal vs CI vs nightly): [`references/execution-matrix.md`](references/execution-matrix.md).

Gerelateerde skills (dieper per rol):
- Unit + system (API): `.claude/skills/tester.md` → agent `taakhelden-tester`
- E2E + load + stress + a11y: `.claude/skills/e2e-tester.md` → agent `taakhelden-e2e`

## Testpiramide

```
                    ┌─────────────┐
                    │  E2E (3)    │  Playwright, k6, DO-stress — traag, weinig
                    │  tests/     │
                ┌───┴─────────────┴───┐
                │   System (2)        │  Workers-runtime, echte D1/DO/R2
                │   apps/api/test/    │  — medium, veel
            ┌───┴─────────────────────┴───┐
            │        Unit (1)             │  Pure logica, mocks — snel, veel
            │  apps/web/**/*.test.ts      │
            │  packages/shared (contract) │
            └─────────────────────────────┘
```

**Regel:** bewijs business-invarianten zo laag mogelijk in de piramide. E2E alleen voor
flows die unit/system niet kunnen afdekken (browser, BFF-cookies, visuele UX).

## Drie niveaus — kort

| Niveau | Wat wordt getest | Waar | Runtime |
|--------|------------------|------|---------|
| **1 — Unit** | Pure functies, Zod-parse, BFF-routes met gemockte upstream | `apps/web/**/*.test.ts`, toekomstig `packages/shared/test/` | Node (Vitest) |
| **2 — System** | Volledige API-stack: routes → repo → D1, FamilyRoom DO, middleware | `apps/api/test/` | Cloudflare Workers (Vitest pool) |
| **3 — E2E** | Browser → Next.js BFF → API; load; DO-stress; a11y | `tests/e2e/`, `tests/load/`, `tests/stress/`, `tests/a11y/` | Playwright / k6 / Vitest |

**Contract-gate** (geen apart niveau, maar verplicht bij schema-wijzigingen):
`npm run openapi:check` — Zod → OpenAPI drift detectie in `packages/shared`.

## Beslisboom: welk niveau schrijf ik?

```
Wijziging raakt...
│
├─ Zod-schema / shared type
│   └─ openapi:check (CI) + system-test die response-shape assert
│
├─ Pure util (datum, avatar, form-validatie)
│   └─ Unit in apps/web/lib/
│
├─ BFF-route (apps/web/app/api/**)
│   └─ Unit met gemockte fetch + cookies (zie accept-parent/route.test.ts)
│
├─ API-route / repo / DO / ledger
│   └─ System in apps/api/test/ — minimaal authz + idempotency indien mutatie
│
├─ UI-flow (klikken, navigatie, saldo zichtbaar)
│   └─ E2E in tests/e2e/ — alleen happy path + één regressie per bug
│
├─ FamilyRoom concurrency / ledger-race
│   └─ System (ledger.test.ts) óf stress in tests/stress/ bij hoge paralleliteit
│
└─ WCAG / contrast / toetsenbord
    └─ a11y in tests/a11y/ (axe-core)
```

## Verplichte invarianten (alle niveaus)

Elke suite beschermt waar mogelijk de zes harde regels uit `COMMON_RULES.md`:

| Invariant | Primair niveau | Voorbeeld |
|-----------|----------------|-----------|
| Cross-family authz | System (verplicht per route) | `authz.test.ts` |
| Idempotency | System | replay `Idempotency-Key` |
| Ledger = som | System (+ stress bij races) | `ledger.test.ts` |
| Geen negatieve mechaniek | System | alleen redemption trekt af |
| Privacy (geen kind-PII) | System + E2E shape-check | response-body assert |
| Zod-validatie | Unit (parse) + System (400/422) | malformed body |

## Wanneer welke suite draaien

| Moment | Commando | Duur (indicatie) |
|--------|----------|------------------|
| Tijdens dev (gericht) | `npm run test -w apps/api -- authz` | 5–30 s |
| Tijdens dev (web) | `npm run test -w apps/web` | < 10 s |
| Pre-commit / pre-push | `npm run typecheck && npm test` | 1–3 min |
| PR (CI) | `.github/workflows/ci.yml` | ≤ 15 min |
| Schema gewijzigd | `npm run openapi:check` | ~10 s |
| Migratie toegevoegd | `npm run db:migrate:local -w apps/api` | ~5 s |
| E2E (niet in standaard-CI) | `npx playwright test` | 5–15 min |
| Pre-release / nightly | E2E + k6 + stress | 15–30 min |

Zie [`references/execution-matrix.md`](references/execution-matrix.md) voor de volledige
matrix (lokaal, cloud-agent, GitHub Actions, nightly, release).

## Eigenaarschap per map

| Pad | Eigenaar | Niveau |
|-----|----------|--------|
| `apps/api/test/` | `taakhelden-tester` | System |
| `apps/web/**/*.test.ts` | `taakhelden-tester` (web-contract) | Unit |
| `packages/shared` | Backend + `openapi:check` | Contract |
| `tests/e2e/` | `taakhelden-e2e` | E2E |
| `tests/load/` | `taakhelden-e2e` | E2E (performance) |
| `tests/stress/` | `taakhelden-e2e` | E2E (DO-stress) |
| `tests/a11y/` | `taakhelden-e2e` | E2E (a11y) |

## Acceptatiecriteria → testmapping

Bij elke user story minimaal:

1. **Happy path** — system (API) of E2E (UI-kritisch)
2. **Authz** — system (cross-family + rol)
3. **Foutpad** — 400/401/403/404, nooit 500 op validatiefout
4. **Idempotency** — system, als mutatie punten/side-effects heeft
5. **Regressie** — gerichte test voor de gerapporteerde bug (prove-it)

## Kwaliteitsgates (samenvatting)

| Gate | Commando | Blokkeert merge |
|------|----------|-----------------|
| Typecheck | `npm run typecheck` | Ja (ci.yml) |
| Lint | `npm run lint` | Ja |
| Unit + system | `npm test` | Ja |
| OpenAPI drift | `npm run openapi:check` | Ja |
| D1 migratie dry-run | `wrangler d1 migrations apply --local` | Ja |
| Arch-check | `/arch-check` | Aanbevolen |
| E2E | Playwright (gepland) | Nee (tot infra staat) |
| Jankurai ratchet | `jankurai.yml` | Optioneel (branch protection) |

## Hiaten & roadmap

| Hiaat | Prioriteit | Actie |
|-------|------------|-------|
| `tests/e2e/` bestaat nog niet | Hoog | Playwright-project + CI-job met path-filter |
| Geen unit-tests in `packages/shared` | Medium | Zod edge-cases naast openapi:check |
| E2E niet in ci.yml | Bewust | Toevoegen als aparte job, niet in default gate |
| iOS unit-tests | Later | `ios.yml` bij `apps/ios`-wijzigingen |

## Output-contract (voor agents)

Bij testwerk altijd rapporteren:
1. Niveau (unit / system / E2E) + bestand(en)
2. Welke invarianten / AC worden afgedekt
3. Waar de suite draait (lokaal / CI / nightly)
4. Echte `npm test` / Playwright-output (niet verzinnen)
5. Handoffs (E8/E9/E23/E31/E32) + docs bijgewerkt
