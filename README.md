# TaakHelden

Gamification-app voor huiswerk en huishoudelijke taken van kinderen.
iOS (SwiftUI) + ouderdashboard (Next.js) op Cloudflare (Workers/D1/R2).

## Structuur
```
apps/api          Cloudflare Worker — Hono API (zie docs/taakhelden-api-specificatie.md)
apps/web          Next.js ouderdashboard
apps/ios          SwiftUI-app (Xcode-project, zie apps/ios/README.md)
packages/shared   Zod-schemas + foutcodes — het API-contract
docs/             productvoorstel · architectuur · API-spec
CLAUDE.md         projectcontext + architectuurregels (leest Claude Code automatisch)
```

## Eerste keer opzetten
```bash
npm ci
cp apps/api/.dev.vars.example apps/api/.dev.vars
npm run db:migrate:local -w apps/api

# Start in twee terminals:
npm run dev:api        # API op http://localhost:8787
npm run dev:web        # ouderdashboard op http://localhost:3000
```

Wrangler emuleert D1, R2, KV, Durable Objects en Queues lokaal via Miniflare.
Voor lokale ontwikkeling is daarom geen Cloudflare-account of remote resource nodig.
De secrets in `.dev.vars.example` zijn uitsluitend veilige lokale placeholders; gebruik
ze nooit in productie. Externe integraties (Turnstile, e-mail, APNs en Apple-login) zijn
optioneel voor de lokale e-mail/wachtwoord-flow.

De remote Cloudflare-resources worden door de deployment-infrastructuur beheerd; maak ze
niet aan als onderdeel van de lokale setup.

## Cloud agents

Cloud agents should start from a Node 22+ environment and run `npm ci` at the
repo root before invoking workspace scripts. A correct baseline means these work
without extra manual setup:

```bash
npm run typecheck
npm test
```

## Controleren
```bash
npm run lint
npm run typecheck
npm test
npm run build -w apps/web
```

## Werkwijze
Feature branch → PR naar `main` (CI verplicht) → merge naar `main` deployt
automatisch naar production. Migraties draaien altijd via de pipeline.
