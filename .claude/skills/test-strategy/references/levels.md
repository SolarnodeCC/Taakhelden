# Testniveaus — detail

## Niveau 1: Unit

### Definitie
Test één eenheid in isolatie: geen netwerk, geen D1, geen Durable Object. Externe
afhankelijkheden worden gemockt of de code is puur.

### Locaties

```
apps/web/lib/**/*.test.ts          # utils, type-parsing, datumlogica
apps/web/app/api/**/route.test.ts  # BFF-handlers (fetch + cookies gemockt)
packages/shared/test/              # (gepland) Zod edge-cases
apps/api/src/services/*.test.ts    # (optioneel) pure helpers, bijv. time/weekDates
```

### Huidige voorbeelden

| Bestand | Wat wordt getest |
|---------|------------------|
| `apps/web/lib/api/types.test.ts` | Response-shapes parsen tegen Zod/shared types |
| `apps/web/lib/taken/dates.test.ts` | Datum/week-logica voor taken-overzicht |
| `apps/web/app/api/auth/accept-parent/route.test.ts` | BFF: upstream mock, cookie-set op happy/error path |

### Wanneer schrijven
- Nieuwe pure functie of util
- BFF-route die request/response transformeert
- Zod-schema met niet-triviale `.refine()` / union-discriminators
- Form-validatie vóór API-call

### Wanneer níet schrijven
- Businessregels die D1 of FamilyRoom nodig hebben → niveau 2
- Volledige login-flow in de browser → niveau 3

### Patroon (web BFF)

```typescript
vi.mock("../../../../lib/api/config", () => ({
  API_BASE_URL: "http://worker.test/v1",
}));
vi.stubGlobal("fetch", vi.fn());
// assert status, body, cookie-calls — geen echte Worker
```

### Snelheid
Doel: **< 50 ms per test**, volledige web-suite **< 15 s**.

---

## Niveau 2: System (integration)

### Definitie
De volledige API-stack in de **echte Cloudflare Workers-runtime** via
`@cloudflare/vitest-pool-workers`. Miniflare emuleert D1, R2, KV, DO en queues.
Geen browser; HTTP via `SELF.fetch` (zie `helpers.ts` → `api()`).

### Locatie

```
apps/api/test/
├── helpers.ts           # seedFamily, parentToken, childToken, api
├── apply-migrations.ts  # D1-schema uit migrations/
├── authz.test.ts        # cross-family + rol (fundament)
├── coreloop.test.ts     # register → taak → afvinken → ledger
├── ledger.test.ts       # saldo = SUM(ledger)
└── <resource>.test.ts   # per domein (tasks, rewards, photos, …)
```

### Configuratie (`apps/api/vitest.config.ts`)
- `singleWorker: true` — één worker-proces; beperkte parallelisatie, wel stabiel
- `isolatedStorage: false` — R2/queue-compatibiliteit; tests seeden eigen `familyId`
- Migraties via `TEST_MIGRATIONS` binding

### Verplicht per nieuwe route
1. Cross-family: token van gezin A → resource van gezin B → 403/404
2. Rol: kind-token op parent-only actie → 403
3. Mutatie met punten: idempotency-replay → één effect
4. Validatie: malformed body → 400/422, geen 500

### Suite-indeling (aanbevolen)

| Suite | Focus |
|-------|-------|
| `authz.test.ts` | Horizontale authz-regressies over routes |
| `coreloop.test.ts` | End-to-end API-flows (geen browser) |
| `<resource>.test.ts` | CRUD + domeinregels per resource |
| `ledger.test.ts` / `ws.test.ts` | DO, WebSocket, concurrentie |

### Snelheid
- Enkel bestand: **5–60 s**
- Volledige API-suite: **1–3 min** (afhankelijk van DO/WS-tests)
- CI-budget: **≤ 15 min** totaal (incl. lint, typecheck)

### Efficiënt draaien

```bash
# Gericht — tijdens feature-werk
npm run test -w apps/api -- authz
npm run test -w apps/api -- rewards.test.ts

# Volledig — pre-push
npm run test -w apps/api
```

---

## Niveau 3: E2E (end-to-end)

### Definitie
Echte browser (Playwright) of externe load-tool (k6) tegen een draaiende stack:
Next.js (`:3000`) → BFF-proxy → Worker (`:8787`). Test wat unit/system niet zien:
cookies, redirects, client-side state, visuele flows.

### Geplande structuur

```
tests/
├── e2e/           # Playwright — kernlus, auth, navigatie
├── load/          # k6 — smoke, drempels p(95) < 500ms
├── stress/        # FamilyRoom — N gelijktijdige ledger-writes
└── a11y/          # axe-core — WCAG 2.1 AA per pagina
```

**Status:** gedocumenteerd in `e2e-tester.md`; mappen bestaan nog niet in de repo.

### Kernlus (verplichte E2E-dekking zodra infra staat)

```
ouder maakt taak → kind vinkt af → punten in saldo → beloning inwisselen → saldo daalt
```

### Infra-vereisten

```bash
# Terminal 1
npm run dev:api          # :8787, JWT_SECRET in .dev.vars, migraties applied

# Terminal 2
npm run dev:web          # :3000, proxy naar API

# Terminal 3
npx playwright test      # tests/e2e/
```

Cloud-agent: API-tests draaien out-of-the-box; E2E vereist beide services + Playwright-setup.

### Wanneer E2E vs system

| Scenario | System | E2E |
|----------|--------|-----|
| Idempotency op `/instances/:id/complete` | ✅ | ❌ |
| Cross-family API 403 | ✅ | ❌ |
| Cookie-refresh na BFF-login | ❌ | ✅ |
| Saldo zichtbaar na page reload | ❌ | ✅ |
| Dubbelklik "Afronden" in UI | optioneel | ✅ |
| k6 p(95) latency onder load | ❌ | ✅ (load/) |
| 50 gelijktijdige DO-writes | stress/ | ✅ |

### Snelheid & kosten
- E2E-spec: **10–60 s** (incl. navigatie)
- Volledige E2E-suite: **5–15 min**
- k6 smoke: **30 s** bij 10 VU
- **Niet** in de standaard PR-gate — te traag en flaky-gevoelig; aparte job of nightly

### Selector-hiërarchie (Playwright)
1. `getByRole`
2. `getByLabel`
3. `getByText`
4. `getByTestId` (laatste redmiddel)
- Nooit ruwe CSS-selectors

---

## Contract-gate (tussen unit en system)

`packages/shared` heeft geen Vitest-suite; drift wordt afgevangen door:

```bash
npm run openapi:check   # genereert OpenAPI uit Zod, faalt bij uncommitted diff
```

Dit is **verplicht in CI** bij elke PR. Aanvulling: system-tests die response-bodies
parsen tegen shared types (zoals `types.test.ts` op de web-kant).
