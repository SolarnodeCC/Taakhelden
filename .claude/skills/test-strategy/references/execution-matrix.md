# Uitvoeringsmatrix — waar draaien welke tests efficiënt?

Doel: maximale feedback per seconde compute. Draai het **kleinste** bewijs dat de
wijziging dekt; escaleer alleen bij merge of release.

## Overzicht

| Suite | Niveau | Lokaal (dev) | Cloud-agent | PR CI (`ci.yml`) | Nightly / release | Geschatte duur |
|-------|--------|--------------|-------------|------------------|-------------------|----------------|
| `npm run typecheck` | — | ✅ altijd | ✅ | ✅ | ✅ | 20–40 s |
| `npm run lint` | — | ✅ pre-push | ✅ | ✅ | ✅ | 15–30 s |
| `npm run test -w apps/web` | Unit | ✅ web-werk | ✅ | ✅ | ✅ | < 15 s |
| `npm run test -w apps/api` | System | ✅ API-werk | ✅ **ideaal** | ✅ | ✅ | 1–3 min |
| `npm run test -w apps/api -- <file>` | System | ✅ **meest efficiënt** | ✅ | ❌ (volledig) | — | 5–60 s |
| `npm run openapi:check` | Contract | ✅ bij schema | ✅ | ✅ | ✅ | ~10 s |
| `db:migrate:local` | Migratie | ✅ bij migratie | ✅ | ✅ dry-run | ✅ prod deploy | 5–15 s |
| `npx playwright test` | E2E | handmatig | ⚠️ infra nodig | 🔜 gepland | ✅ | 5–15 min |
| `k6 run tests/load/` | Load | tegen staging | tegen preview URL | ❌ | ✅ pre-release | 30 s – 5 min |
| `tests/stress/` | Stress | bij DO-wijziging | ✅ | 🔜 optioneel | ✅ | 30 s – 2 min |
| `tests/a11y/` | a11y | bij UI-pagina | component-level OK | 🔜 | ✅ | 10–60 s |
| `ios.yml` | Unit (Swift) | macOS only | ❌ | ✅ path `apps/ios/**` | ✅ TestFlight | 10–20 min |
| `jankurai.yml` | Static audit | optioneel | ❌ | ✅ aparte job | ✅ | 5–10 min |

Legenda: ✅ = aanbevolen | ⚠️ = mogelijk met setup | ❌ = niet / niet efficiënt | 🔜 = gepland

---

## Per ontwikkelfase

### 1. Tijdens coden (tight loop, < 30 s)

| Wijziging in | Draai |
|--------------|-------|
| `apps/web/lib/**` | `npm run test -w apps/web -- <bestand>` |
| `apps/web/app/api/**` | idem + route.test.ts naast handler |
| `apps/api/src/routes/**` | `npm run test -w apps/api -- <resource>.test.ts` |
| `apps/api/src/repo/**` | idem + `authz.test.ts` als authz-pattern wijzigt |
| `packages/shared/**` | `npm run openapi:check` + gerichte API-test |

**Niet** doen: volledige `npm test` of Playwright bij elke save.

### 2. Pre-commit / pre-push (CI-pariteit, < 3 min)

```bash
npm run typecheck && npm run lint && npm test
```

Optioneel bij migratie:
```bash
npm run db:migrate:local -w apps/api
```

### 3. Pull request (GitHub Actions — `ci.yml`)

Eén job `checks` op `ubuntu-latest`, Node 22:

```
npm ci → openapi:check → lint → typecheck → npm test → D1 migrate dry-run
```

**Waarom alles in één job?**
- Eén `npm ci` — dependency-cache efficiënter dan gesplitste jobs
- API system-tests zijn de bottleneck (~70% van testtijd)
- Totaal past in `timeout-minutes: 15`

**Waarom E2E níet in ci.yml?**
- Vereist twee long-running servers (API + web)
- 5–15 min extra + hogere flake-rate
- System-tests dekken dezelfde invarianten goedkoper
- **Plan:** aparte workflow `e2e.yml` met `paths:`-filter op `apps/web/**` + `tests/e2e/**`

### 4. Cloud-agent (Cursor)

| Wat werkt out-of-the-box | Wat vereist extra setup |
|--------------------------|-------------------------|
| `npm test` (API + web unit) | Playwright (API + web servers) |
| `npm run typecheck`, `lint` | k6 (CLI + target URL) |
| `db:migrate:local` | E2E tegen preview-deploy |

Cloud-agents zijn **optimaal voor system-tests**: Workers-pool draait identiek aan CI,
geen browser-overhead.

### 5. Nightly / pre-release (langzaam, breed)

Voorgestelde `nightly.yml` (nog niet geïmplementeerd):

```yaml
schedule:
  - cron: "0 2 * * *"   # 02:00 UTC
jobs:
  e2e:
    # start API + web, playwright test
  load:
    # k6 tegen staging/preview BASE_URL
  stress:
    # npm test -- tests/stress/
```

Trigger ook handmatig vóór productie-deploy (`deploy-prod.yml` smoke is nu minimaal).

### 6. Path-based triggers (efficiëntie bij schaal)

| Pad gewijzigd | Minimale verplichte suites |
|---------------|---------------------------|
| `apps/api/**` | `npm run test -w apps/api` |
| `apps/web/**` (geen API) | `npm run test -w apps/web` + typecheck |
| `packages/shared/**` | `openapi:check` + `npm test` (beide workspaces) |
| `apps/api/migrations/**` | migrate dry-run + API tests |
| `apps/ios/**` | `ios.yml` (macOS-runner) |
| `tests/e2e/**` | E2E workflow only |

Huidige CI draait **altijd alles** — correct voor repo-grootte nu; path-filters zijn
winst bij > 5 min CI-tijd.

---

## Parallelisatie & bottlenecks

### API (system)
- `singleWorker: true` in vitest.config — **geen** parallelle workers
- Tests isoleren via unieke `seedFamily(prefix)` per test
- DO/WS-tests: expliciete timeout `it('…', async () => {}, 10_000)`

**Efficiëntie-tip:** groepeer trage tests (ws, stress) in aparte bestanden zodat
`vitest -- <snel-bestand>` de trage suite overslaat tijdens dev.

### Web (unit)
- Standaard Vitest in Node — **wel** parallel
- Geen Workers-pool nodig

### E2E (toekomst)
- Playwright: `fullyParallel: true` per spec-file, **niet** per test als state gedeeld wordt
- Eén browser-context per test; eigen testgezin via API-seed helper
- Chromium preinstalled in cloud (`PLAYWRIGHT_BROWSERS_PATH`) — geen `playwright install`

### macOS (iOS)
- Duurste runner — **alleen** bij `apps/ios/**` wijzigingen (`ios.yml`)
- Unit in Swift, geen XCUITest in elke PR (productvoorstel §9)

---

## Kosten / feedback trade-off

```
Snelheid ──────────────────────────────────────────────► Dekking
  typecheck → web unit → API system → openapi → E2E → k6/stress
     ~30s       ~10s        ~2min        ~10s      ~10min    ~15min
```

**Vuistregel:**
- Bug in ledger/idempotency → system-test, nooit E2E
- Bug in cookie/BFF-redirect → unit (BFF) + optioneel E2E
- Bug in "knop werkt niet" → E2E prove-it, daarna fix
- Performance-regressie → k6 threshold, niet Playwright

---

## CI-workflows naast ci.yml

| Workflow | Doel | Blokkeert PR? |
|----------|------|---------------|
| `ci.yml` | Lint, types, unit+system, migratie | Ja (bedoeld) |
| `jankurai.yml` | Static quality ratchet | Optioneel (branch protection) |
| `claude.yml` | Agent automation | Nee |
| `deploy-prod.yml` | API deploy + smoke | Na merge |
| `deploy-web.yml` | Web deploy + smoke | Na merge |
| `ios.yml` | Xcode build/test | Bij iOS-wijzigingen |

---

## Checklist nieuwe test toevoegen

1. **Niveau gekozen?** (beslisboom in SKILL.md)
2. **Juiste map?** (eigenaarschap respecteren)
3. **Isolatie?** (eigen `seedFamily` / eigen mock — geen gedeelde state)
4. **Waar draait hij in CI?** (standaard `npm test` of aparte job)
5. **Timeout?** (DO/WS/E2E ≥ 10 s expliciet)
6. **Geen `it.skip` / `test.only`** in committed code
