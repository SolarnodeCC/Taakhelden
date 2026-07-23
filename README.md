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
npm install
# Cloudflare-resources (eenmalig):
cd apps/api
npx wrangler d1 create taakhelden-db --location=weur   # id → wrangler.toml
npx wrangler kv namespace create KV                    # id → wrangler.toml
npx wrangler r2 bucket create taakhelden-photos --jurisdiction=eu
npx wrangler queues create photo-processing
npx wrangler secret put JWT_SECRET
# Lokaal draaien:
npm run db:migrate:local
npm run dev            # API op http://localhost:8787
```

## Werkwijze
Feature branch → PR naar `main` (CI verplicht) → merge naar `main` deployt
automatisch naar production. Migraties draaien altijd via de pipeline.
