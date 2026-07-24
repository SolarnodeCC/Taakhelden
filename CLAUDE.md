# TaakHelden — projectcontext voor Claude Code

Gamification-app (iOS + web) waarmee kinderen punten verdienen met huiswerk en
huishoudelijke taken. Ouders beheren taken en beloningen. Doelgroep: gezinnen in NL.

## Documentatie (lees deze bij twijfel)
- `docs/taakhelden-productvoorstel.md` — functioneel ontwerp, gamification, UI-richtlijnen
- `docs/taakhelden-cloudflare-github-architectuur.md` — infrastructuur en CI/CD
- `docs/taakhelden-api-specificatie.md` — het API-contract (leidend voor alle endpoints)

## Stack
- **API**: Cloudflare Worker, Hono, TypeScript — `apps/api`
- **DB**: D1 (SQLite, location hint `weur`), migraties in `apps/api/migrations` (genummerde .sql)
- **Foto's**: R2 (jurisdiction `eu`, lifecycle 30 dagen), presigned URLs
- **Realtime**: Durable Object `FamilyRoom` (1 per gezin) — WebSocket + serialisatie van ledger-writes
- **Web**: Next.js ouder-dashboard — `apps/web`
- **iOS**: SwiftUI (apart Xcode-project in `apps/ios`)
- **Gedeeld contract**: Zod-schemas + foutcodes in `packages/shared`

## Harde architectuurregels
1. **Routes praten nooit rechtstreeks met D1.** Alle SQL leeft in `apps/api/src/repo/`;
   elke repo-functie heeft `familyId` als verplicht eerste argument. Dit is de
   security-grens (D1 heeft geen row-level security).
2. **Alle mutatie-endpoints zijn idempotent** via de `Idempotency-Key` header.
   Dubbel afvinken mag nooit dubbele punten opleveren.
3. **Puntensaldo = som van het ledger** (`points_ledger`), nooit een los saldoveld.
   Ledger-writes lopen via de FamilyRoom-DO.
4. **Geen negatieve mechanieken**: nooit punten afboeken behalve bij het inwisselen
   van beloningen (redemption) of annulering daarvan.
5. **Privacy**: geen e-mail/PII van kinderen; foto's krijgen EXIF-strip vóór ze
   zichtbaar worden; log nooit namen of foto-URLs.
6. **Requests/responses valideren met de Zod-schemas uit `packages/shared`** —
   nieuwe velden eerst daar toevoegen.

## Taal & toon
- Code, identifiers en commits: Engels. Gebruikersgerichte strings: Nederlands.
- Notificatie- en fouttekst voor kinderen: altijd positief geformuleerd
  (zie stijlgids in het productvoorstel, §3.7). Nooit schuldgevoel-taal.

## UI & Design
- **`Design System/`** (repo-root) is leidend voor alle visuele keuzes: tokens,
  componenten, en UI-kits. Lees `Design System/readme.md` bij UI-werk.
- **Twee registers, één token-set.** Ouder-dashboard = kalm/neutraal (wit, één teal
  accent, dunne randen). Kind-app = warm/rond (koraal/turquoise/geel op crème). Teen
  mode = gedempt (donkerblauw/mint). Kies bewust het juiste register.
- **`apps/web/app/globals.css` is de token-bron** voor de web-app (gespiegeld in
  `Design System/tokens/`). Gebruik altijd de token-variabelen / Tailwind-utilities
  (`bg-accent`, `rounded-xl`, `shadow-kid`); **nooit ruwe hex/px** hardcoderen.
- Kid/teen-paletten zijn **inferred/placeholder** tot echte branding er is — zie de
  vlaggen in `globals.css` en de readme.
- Herbruik de primitives in `apps/web/components/ui/` i.p.v. ad-hoc markup.
- Bij UI-werk: gebruik de **`design-system`**-skill; check de diff met **`/design-check`**
  (`@ui-design-reviewer`). Kindgerichte tekst blijft via `@dutch-child-copy`.

## Commands
- `npm run dev:api` — Worker lokaal (wrangler dev)
- `npm run dev:web` — Next.js dev server
- `npm test` — Vitest in Workers-runtime (`@cloudflare/vitest-pool-workers`)
- `npm run typecheck` — alle workspaces
- Migratie lokaal: `npx wrangler d1 migrations apply taakhelden-db --local` (vanuit `apps/api`)

## Workflow
- Feature branch → PR naar `main` (squash merge). CI moet groen zijn.
- Migraties: nieuw genummerd bestand toevoegen, nooit bestaande migraties wijzigen.
- Bij elke nieuwe route: Zod-schema in shared + authz-test in `apps/api/test`.
