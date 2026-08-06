# Wispel (historisch: TaakHelden) — projectcontext voor Claude Code

Gamification-app (iOS + web) waarmee kinderen punten verdienen met huiswerk en
huishoudelijke taken. Ouders beheren taken en beloningen. Doelgroep: gezinnen in NL.

**Productnaam:** Wispel · **Domein:** wispel.cc  
**Principes (ADR-0005):** privacy first · **gratis voor gezinnen** · optionele **donaties** (alleen ouder-facing). Geen freemium, geen trial-paywall, geen ads/child-tracking.

Codebase-paden en Worker-namen kunnen nog `taakhelden` heten tot WS-STRINGS / WS-INFRA; gebruikersgerichte copy en nieuwe docs zeggen **Wispel**.

## Documentatie (lees deze bij twijfel)
- `docs/wispel-rebrand-and-ui-plan.md` — rebrand-strategie, ChoreHero-appendix
- `docs/wispel-build-plan-workstreams.md` — **build plan, workstreams, open points §13**
- `docs/adr/ADR-0005-wispel-privacy-free-donations.md` — privacy first + free/donations
- `docs/adr/ADR-0006-ai-policy-and-approved-use-cases.md` — **AI-beleid, toegestane use cases, App Store-conformiteit**
- `docs/wispel-ai-workstreams.md` — AI-workstreams (scope, AC, Gate G-AI)
- `docs/taakhelden-productvoorstel.md` — functioneel ontwerp, gamification, UI-richtlijnen (naam historisch; verdienmodel bijgewerkt)
- `docs/taakhelden-cloudflare-github-architectuur.md` — infrastructuur en CI/CD
- `docs/taakhelden-api-specificatie.md` — het API-contract (leidend voor alle endpoints)
- `docs/taakhelden-ios-bouwvoorstel.md` — iOS-bouwvoorstel (SwiftUI ↔ API/web/DS)

## Stack
- **API**: Cloudflare Worker, Hono, TypeScript — `apps/api`
- **DB**: D1 (SQLite, location hint `weur`), migraties in `apps/api/migrations` (genummerde .sql)
- **Foto's**: R2 (jurisdiction `eu`, lifecycle 30 dagen), presigned URLs
- **Realtime**: Durable Object `FamilyRoom` (1 per gezin) — WebSocket + serialisatie van ledger-writes
- **Web**: Next.js ouder-dashboard — `apps/web` (marketinglanding volgt WS-WEB-MKT)
- **iOS**: SwiftUI (apart Xcode-project in `apps/ios`)
- **Gedeeld contract**: Zod-schemas + foutcodes in `packages/shared`

## Harde architectuurregels
1. **Routes praten nooit rechtstreeks met D1.** Alle SQL leeft in `apps/api/src/repo/`;
   elke repo-functie heeft `familyId` als verplicht eerste argument. Dit is de
   security-grens (D1 heeft geen row-level security).
2. **Ledger-affecting mutaties zijn idempotent** via de `Idempotency-Key` header
   (approve/complete/redeem/adjust/cancel/goals/sync e.d.). Dubbel afvinken mag
   nooit dubbele punten opleveren. Overige mutaties cachen optioneel op die header
   (KV-middleware na auth); ledger-routes **vereisen** de header.
3. **Puntensaldo = som van het ledger** (`points_ledger`), nooit een los saldoveld.
   Ledger-writes lopen via de FamilyRoom-DO.
4. **Geen negatieve mechanieken**: nooit punten afboeken behalve bij het inwisselen
   van beloningen (redemption) of annulering daarvan.
5. **Privacy**: geen e-mail/PII van kinderen; foto's krijgen EXIF-strip vóór ze
   zichtbaar worden; log nooit namen of foto-URLs. **Geen ads / geen child-tracking SDK’s.**
6. **Requests/responses valideren met Zod** — canonieke schemas in `packages/shared`.
   Nieuwe request/response-velden eerst daar toevoegen. Legacy mirrors in
   `apps/web/lib/api/types.ts` mogen tijdelijk bestaan; geen nieuwe drift.
7. **Geen betaalmuur op kernfuncties**; donatie-UI nooit op kind-tabbladen (ADR-0005).
8. **AI alleen binnen ADR-0006**: uitsluitend Workers AI (`c.env.AI`) in het productpad, nooit
   kind-PII in een prompt, nooit vrije AI-tekst richting een kind, en AI-output schrijft nooit
   naar het ledger. Geen AI-feature zonder Zod-validatie, deterministische fallback en kill switch.

## Taal & toon
- Code, identifiers en commits: Engels. Gebruikersgerichte strings: Nederlands.
- Notificatie- en fouttekst voor kinderen: altijd positief geformuleerd
  (zie stijlgids in het productvoorstel, §3.7). Nooit schuldgevoel-taal.
- Nieuwe copy: productnaam **Wispel**; kindvocabulaire **Ster / Star** (O1); nooit Held/Hero.

## UI & Design
- **`Design System/`** (repo-root) is leidend voor alle visuele keuzes: tokens,
  componenten, en UI-kits. Lees `Design System/readme.md` bij UI-werk.
- **Twee registers, één token-set.** Ouder-dashboard = kalm/neutraal (wit, één teal
  accent, dunne randen). Kind-app = warm/rond (koraal/turquoise/geel op crème). Teen
  mode = gedempt (donkerblauw/mint). Kies bewust het juiste register.
- **`apps/web/app/globals.css` is de token-bron** voor de web-app (gespiegeld in
  `Design System/tokens/`). Gebruik altijd de token-variabelen / Tailwind-utilities
  (`bg-accent`, `rounded-xl`, `shadow-kid`); **nooit ruwe hex/px** hardcoderen.
- Kid/teen-paletten zijn **shipping brand v1** — zie `docs/brand/wispel-brand-v1.md`
  en `apps/web/app/globals.css` (gespiegeld in Design System tokens + `THPalettes`).
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
- Rebrand/build-volgorde: volg `docs/wispel-build-plan-workstreams.md` (Horizon A eerst).
