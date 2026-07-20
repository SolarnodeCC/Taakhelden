# TaakHelden — Architectuur op Cloudflare + GitHub
*Vervolg op het productvoorstel; dit document vertaalt de architectuur naar een concrete Cloudflare-stack met GitHub als versiebeheer en CI/CD.*

---

## 1. Waarom deze stack past

Cloudflare dekt vrijwel alles wat TaakHelden nodig heeft serverless af: API, database, foto-opslag, realtime, geplande jobs en hosting van het web-dashboard — zonder servers te beheren, met lage kosten op MVP-schaal (genereus gratis tier) en wereldwijde edge-performance. GitHub levert versiebeheer, code review, CI/CD (Actions) en preview-omgevingen per pull request.

**Belangrijk aandachtspunt vooraf (privacy):** Cloudflare is een Amerikaans bedrijf. Voor de AVG-positie rond kinderdata:
- Sluit de **Cloudflare DPA** (standaard beschikbaar, incl. SCC's).
- Gebruik **location hints EU** voor D1 en **jurisdiction `eu` voor R2** (foto's van kinderen blijven dan fysiek in de EU opgeslagen).
- Overweeg bij groei de **Data Localization Suite** (Regional Services) zodat ook TLS-terminatie en verwerking in de EU blijven.
- Documenteer dit in de DPIA; dit is verdedigbaar, maar moet expliciet vastgelegd worden.

---

## 2. Architectuuroverzicht

```
┌────────────┐      ┌─────────────────────────┐
│  iOS-app    │      │  Web-dashboard (ouders) │
│  SwiftUI    │      │  Next.js / React        │
└─────┬──────┘      │  Cloudflare Workers      │
      │             │  (static assets)         │
      │             └───────────┬─────────────┘
      │       HTTPS / WebSocket │
      ▼                         ▼
┌─────────────────────────────────────────────┐
│        API — Cloudflare Worker (Hono, TS)    │
│  Auth · REST-endpoints · Zod-validatie · RLS │
└──┬────────┬────────┬─────────┬──────────┬───┘
   │        │        │         │          │
   ▼        ▼        ▼         ▼          ▼
┌──────┐ ┌──────┐ ┌───────┐ ┌────────┐ ┌─────────┐
│  D1   │ │  R2   │ │  KV    │ │Durable │ │ Queues + │
│ SQLite│ │foto's │ │sessies│ │Objects │ │  Cron    │
│ (EU)  │ │ (EU)  │ │/cache │ │realtime│ │ Triggers │
└──────┘ └──────┘ └───────┘ └────────┘ └─────────┘
                                   │
                                   ▼
                          APNs (push naar iOS)
```

---

## 3. Componentkeuzes per onderdeel

| Behoefte | Cloudflare-dienst | Toelichting |
|---|---|---|
| **API** | Workers + **Hono** (TypeScript) | Lichtgewicht router, uitstekende Workers-support, middleware voor auth/validatie. Eén Worker als API-monoliet is prima voor MVP. |
| **Database** | **D1** (location hint `weur`) | Gezinnen, taken, ledger. SQLite-model past goed: data is klein en per gezin gepartitioneerd. Migratiepad naar Postgres (via **Hyperdrive**) als je D1-limieten raakt. |
| **Foto's** | **R2** met jurisdiction `eu` | S3-compatibel, geen egress-kosten. **Lifecycle rule: objecten na 30 dagen automatisch verwijderen** — de data-minimalisatie uit het voorstel wordt zo op infra-niveau afgedwongen. Upload via presigned URLs vanuit de Worker. |
| **Fotoverwerking** | **Queues** + Worker-consumer | Na upload: EXIF/locatiedata strippen, thumbnail maken (Cloudflare **Images** of `photon`-wasm), daarna pas zichtbaar voor ouder. |
| **Realtime (ouder ziet afvinken direct)** | **Durable Objects** met WebSocket hibernation | Eén DO per gezin ("FamilyRoom"): kind vinkt af → DO broadcast naar verbonden ouder-dashboards. DO bewaakt ook puntenconsistentie (serialisatie van ledger-writes per gezin). |
| **Herhalende taken** | **Cron Trigger** (dagelijks 00:05 lokale tijd via tijdzone-berekening) | Genereert TaskInstances van de dag uit recurrence rules. |
| **Notificaties** | Cron (elke 15 min) + Queue → **APNs** | Worker ondertekent APNs JWT (ES256, key als secret) en pusht via HTTP/2. Bedtijd- en max-2-per-dag-regels in de scheduler. |
| **Sessies/cache** | **KV** | Sessietokens (kind-pincodesessies kort TTL), gezinscodes, template-cache. |
| **Web-dashboard** | **Workers static assets** (of Pages) met Next.js | Zelfde repo, preview-deploy per PR. |
| **Bot/misbruikbescherming** | **Turnstile** op registratie/login | Onzichtbare captcha, privacyvriendelijk (geen tracking — belangrijk gezien doelgroep). |
| **Rate limiting** | Workers Rate Limiting API / WAF-rules | Op login, pincode-pogingen, uploads. |
| **Secrets** | `wrangler secret` + GitHub Environments | APNs-key, JWT-signing key, Apple Sign-in secret. Nooit in code. |
| **Observability** | Workers Logs / Logpush + Sentry (EU-regio) | Foutmonitoring zonder PII in logs (log family_id, nooit namen/foto-URLs). |

**Auth:** zelf beheren op de Worker (bijv. met `better-auth` of eigen JWT-implementatie op D1): Sign in with Apple + e-mail/wachtwoord voor ouders; gezinscode + pincode (Argon2-hash via wasm) voor kinderen. Geen externe auth-SaaS nodig → minder subverwerkers in je AVG-register.

---

## 4. GitHub-inrichting

### 4.1 Monorepo-structuur

```
taakhelden/
├── apps/
│   ├── api/            # Cloudflare Worker (Hono + TS)
│   │   ├── src/
│   │   ├── migrations/ # D1 SQL-migraties (genummerd)
│   │   └── wrangler.toml
│   ├── web/            # Next.js ouder-dashboard
│   └── ios/            # Xcode-project (SwiftUI)
├── packages/
│   └── shared/         # Zod-schemas + TS-types (API-contract)
│                       # → OpenAPI genereren → Swift-modellen
├── .github/
│   ├── workflows/      # CI/CD (zie 4.3)
│   ├── CODEOWNERS
│   └── dependabot.yml
└── docs/               # productvoorstel, DPIA, ADR's
```

Eén bron van waarheid voor het API-contract: Zod-schemas in `packages/shared`, daaruit OpenAPI genereren en met Swift OpenAPI Generator de iOS-modellen — voorkomt drift tussen app, web en API.

### 4.2 Branch- & omgevingsstrategie

- `main` = productie; korte feature branches + PR's; squash merge.
- **GitHub Environments**: `dev` → `staging` → `production`, elk met eigen Cloudflare-resources (aparte D1-database, R2-bucket, Worker) en eigen secrets. Production met required reviewer.
- Branch protection op `main`: PR verplicht, CI groen, geen force-push.
- Preview per PR: Workers preview-URL voor API én web, zodat je elke wijziging klikbaar kunt testen.

### 4.3 GitHub Actions (CI/CD)

| Workflow | Trigger | Doet |
|---|---|---|
| `ci.yml` | elke PR | Lint, typecheck, unit tests (Vitest + `@cloudflare/vitest-pool-workers` — draait tests in echte Workers-runtime), D1-migraties dry-run |
| `deploy-staging.yml` | merge naar `main` | `wrangler d1 migrations apply` (staging) → `wrangler deploy` API + web naar staging → smoke test |
| `deploy-prod.yml` | handmatige approval / tag | Zelfde stappen naar production |
| `ios.yml` | PR die `apps/ios` raakt | Xcode build + tests (macOS-runner); TestFlight-upload via Fastlane bij release-tag |
| `security` | wekelijks + PR | Dependabot, CodeQL, secret scanning (staat aan op repo-niveau) |

Cloudflare-deploys via `cloudflare/wrangler-action`; het Cloudflare API-token (scoped: alleen Workers/D1/R2 van dit account) staat als secret in de GitHub Environment.

**D1-migraties**: genummerde SQL-bestanden in `apps/api/migrations/`, toegepast door de pipeline vóór de deploy — nooit handmatig op productie.

### 4.4 Repo-hygiëne
- **CODEOWNERS** voor `migrations/` en auth-code (extra review op gevoelige wijzigingen).
- **ADR's** (Architecture Decision Records) in `docs/adr/` — begin met ADR-001 "Cloudflare + GitHub" en ADR-002 "D1 vs Postgres".
- Issues/Projects voor de MVP-backlog uit het productvoorstel; labels per epic (taken, punten, privacy, UI-kind, UI-ouder).
- Private repo; secret scanning + push protection aan.

---

## 5. Security op deze stack (aanvullend op het voorstel)

1. **RLS-equivalent in code**: D1 heeft geen row-level security zoals Postgres — dwing `family_id`-scoping af in één centrale repository-laag + Hono-middleware die de JWT-claims (family_id, rol) aan élke query bindt. Test dit expliciet (authz-testsuite in CI).
2. **Foto-flow**: upload → R2 (presigned, max 10 MB, alleen jpeg/heic) → Queue → EXIF-strip + thumbnail → pas dan record "zichtbaar". Originele upload met GPS-data wordt nooit geserveerd.
3. **Foto-levering** via de Worker met korte signed URLs (5 min TTL) — R2-bucket nooit publiek.
4. **Kind-sessies**: JWT met korte levensduur (24 u) en alleen `child`-scope; pincode-pogingen rate-limited (5 pogingen → 15 min lock, melding naar ouder).
5. **Verwijderrecht**: één endpoint dat gezin/kind cascade-verwijdert uit D1 + R2 prefix-delete + KV-cleanup; bevestiging + 7 dagen soft-delete-venster voor "oeps".
6. **Backups**: D1 Time Travel (30 dagen point-in-time restore) + wekelijkse export naar een aparte EU R2-bucket.

---

## 6. Kostenindicatie (MVP-schaal, ~1.000 gezinnen)

| Dienst | Verwachting |
|---|---|
| Workers Paid-plan | $5/mnd (nodig voor Durable Objects, Queues, hogere limieten) |
| D1 / KV / Queues | Binnen de bundel op deze schaal |
| R2 | Foto's zijn 30 dagen houdbaar → opslag blijft klein; enkele $/mnd |
| Apple Developer | $99/jaar |
| GitHub | Gratis (private repo, Actions-minuten volstaan; macOS-minuten voor iOS-CI zijn de grootste post) |

Totaal infra: richting **< €20/maand** tot ruim boven de eerste duizenden gezinnen.

---

## 7. Eerste sprint (setup, week 1–2)

1. GitHub-repo + monorepo-skelet + branch protection + Environments.
2. Cloudflare-account: Workers Paid, D1 (`weur`), R2 (`eu`-jurisdiction, lifecycle 30 d), API-token voor CI.
3. Hono-Worker "hello world" + eerste D1-migratie (Family/User) + CI-pipeline end-to-end naar staging.
4. Auth-flow ouder (Sign in with Apple + e-mail) en gezinscode-flow kind.
5. Next.js-dashboard-skelet gedeployed met preview-per-PR.
6. ADR-001/002 vastleggen; DPIA-document starten in `docs/`.

Daarna volgt de functionele MVP-backlog uit het productvoorstel (taken → afvinken → punten → winkel).
