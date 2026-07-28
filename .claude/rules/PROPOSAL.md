# Voorstel: `.claude/rules/` met glob-patterns voor TaakHelden

> **Status:** geïmplementeerd — **pakket C** (alle 15 rules + subdirs, lazy `paths`).
> Beslisdocument; rule-bestanden zijn de actieve bron.
>
> **Bronnen:** `agent/baselines/main.repo-score.json` (Jankurai v1.6.10, score 47),
> `target/jankurai/taakhelden-code-review.md` (handmatige review F1–F7),
> `agent/audit-policy.toml`, bestaande `.claude/hooks/` en `.claude/skills/`.

## Doel

Path-scoped rules vullen **COMMON_RULES** en **skills** aan: ze laden alleen wanneer Claude
een bestand in dat pad leest/bewerkt, zodat context klein blijft maar **Jankurai-findings**
en architectuurregels **per laag** expliciet zijn.

| Mechanism | Wanneer laden | TaakHelden-voorbeeld |
|-----------|---------------|----------------------|
| `CLAUDE.md` / rules zonder `paths` | Elke sessie | Zes harde regels (al in COMMON_RULES) |
| `.claude/rules/*.md` + `paths` | Bij match op gelezen bestand | Repo-laag, BFF, migraties |
| Skills | Op invoke / model-keuze | `design-system`, `endpoint-scaffold` |
| Hooks | Pre/PostToolUse, hard block | `block-migration-edit`, `guard-route-sql` |

## Frontmatter — twee werkende modi

Claude Code ondersteunt path-scoping via YAML frontmatter. Voor **lazy loading** (rule
alleen bij touch van matching file) gebruik expliciet:

```yaml
---
alwaysApply: false
paths: apps/api/src/routes/**/*.ts
---
```

Alternatief (officiële docs, YAML-lijst — kan eager laden afhankelijk van versie):

```yaml
---
paths:
  - "apps/api/src/routes/**/*.ts"
---
```

**Beslis:** lazy (`alwaysApply: false` + CSV `paths`) vs. documentatie-lijst (`paths: -`).

Glob-syntax: `**` = recursief; `{ts,tsx}` = alternatieven; leading pad = vanaf repo-root.

---

## Voorgestelde bestandsstructuur

```
.claude/rules/
  PROPOSAL.md                 ← dit document
  README.md                   ← (optioneel) index + link naar owner-map
  always/
    workflow.md               ← altijd laden — proof lanes, npm gates
  api/
    routes.md
    repo.md
    services-and-do.md
    middleware.md
    migrations.md
    tests.md
  shared/
    schemas.md
  web/
    ui.md
    bff.md
    i18n.md
  ios/
    swift.md
  ops/
    ci-and-agent.md
    generated-zones.md
  docs/
    markdown.md
```

**Beslis:** platte lijst (`api-routes.md` in root) vs. subdirectories (`api/routes.md`).

---

## Rule 1 — `always/workflow.md` (geen `paths`)

**Altijd in context** — adresseert Jankurai *context economy* en *proof lanes* zonder
elke sessie alle API/web-regels te laden.

| Jankurai cap / finding | Wat de rule zegt |
|------------------------|------------------|
| `no-one-command-setup-or-validation` | Root gate: `npm run typecheck && npm test` |
| `Proof lanes and test routing` (score −22) | `agent/test-map.json` — welk pad → welk commando |
| `Ownership and navigation` (score −2) | `agent/owner-map.json` — wie owns wat |
| HLT-004-UNMAPPED-PROOF | Bij wijziging in `agent/`, `docs/`, root `*.md` → test-map entry |

**Inhoud (kern):**

- Voor PR: `npm run typecheck`, `npm test`, `/arch-check` schoon.
- Nieuwe route ⇒ schema in `packages/shared` + authz-test in `apps/api/test/`.
- Migratie ⇒ alleen nieuw genummerd bestand (`/new-migration`).
- Geen bewerking van `target/jankurai/repo-score.json` (generated zone).

**Beslis:** ✅ aanbevolen (klein, ~40 regels) vs. ❌ alles in `CLAUDE.md` houden.

---

## Rule 2 — `api/routes.md`

```yaml
alwaysApply: false
paths: apps/api/src/routes/**/*.ts
```

| Jankurai / review | Regel |
|-------------------|-------|
| HLT-006-DIRECT-DB-WRONG-LAYER | Geen `.prepare(`, `.batch(`, SQL-strings — hook `guard-route-sql.mjs` |
| HLT-031-TYPESCRIPT-BAD-BEHAVIOR | Geen `JSON.parse`/`atob` op user input zonder try/catch + Zod (F1 ledger cursor) |
| F2 (review) | Ledger-mutaties: `requireIdempotencyKey`, niet alleen optionele `idempotency` |
| F7 (review) | Geen CORS toevoegen; browser gaat via Next BFF |
| Arch rule 6 | `validate("json", …)` met schema uit `packages/shared` |

**Overlap:** skill `endpoint-scaffold` — rule = harde checklist; skill = templates.

**Beslis:** ✅ / ❌ / ⚠️ alleen hook vertrouwen (geen rule).

---

## Rule 3 — `api/repo.md`

```yaml
alwaysApply: false
paths: apps/api/src/repo/**/*.ts
```

| Jankurai / review | Regel |
|-------------------|-------|
| HLT-031-TYPESCRIPT-BAD-BEHAVIOR | Geen `as unknown as Row` — parse via Zod of row-mapper (F5) |
| HLT-023-INPUT-BOUNDARY-GAP | User input alleen via bound params; dynamic SQL = whitelisted kolommen + `?` |
| `raw shell or SQL from untrusted TS` | Nooit user string in query body; zie `updateTask`, `listEntries` patroon |
| Arch rule 1 | `familyId` eerste arg na DB; elke query `family_id = ?` |

**Beslis:** ✅ / ❌

---

## Rule 4 — `api/services-and-do.md`

```yaml
alwaysApply: false
paths: apps/api/src/services/**/*.ts,apps/api/src/do/**/*.ts,apps/api/src/jobs/**/*.ts
```

| Jankurai / review | Regel |
|-------------------|-------|
| HLT-001-DEAD-MARKER (`sync.ts`, `ws.ts`, `familyRoom.ts`) | Geen `TODO`/`stub`/`not implemented` in productpad — false positive op `.stub` DO-calls documenteren |
| Arch rule 3–4 | Ledger-writes via FamilyRoom DO; geen negatieve mechaniek |
| F3 (review) | Foto-URL signing: voorkeur `PHOTO_URL_SECRET`, niet `JWT_SECRET` hergebruiken |

**Beslis:** ✅ / ❌

---

## Rule 5 — `api/middleware.md`

```yaml
alwaysApply: false
paths: apps/api/src/middleware/**/*.ts
```

| Jankurai / review | Regel |
|-------------------|-------|
| F6 (review) | Idempotency-key scope `(userId, key)` — documenteer in API-spec als bewust |
| Auth | JWT HS256 via `jose`; ws-tokens niet op REST-pad |

**Beslis:** ✅ / ❌ (laag volume — kan samengevoegd met `routes.md`).

---

## Rule 6 — `api/migrations.md`

```yaml
alwaysApply: false
paths: apps/api/migrations/**/*.sql
```

| Jankurai / hook | Regel |
|-----------------|-------|
| `block-migration-edit.mjs` | Bestaande `NNNN_*.sql` nooit wijzigen |
| test-map | Proof: `npm run db:migrate:local -w apps/api` |

**Beslis:** ✅ (hook + rule = dubbele borging) / ❌ alleen hook.

---

## Rule 7 — `api/tests.md`

```yaml
alwaysApply: false
paths: apps/api/test/**/*.ts
```

| Jankurai | Regel |
|----------|-------|
| HLT-010-SECRET-SPRAWL | Geen echte secrets in tests; gebruik helpers `seedFamily`, tokens uit helpers |
| Proof lanes | Cross-family 403/404 minimaal; helpers uit `helpers.ts` |
| F1 | Regression voor malformed cursor → 400 |

**Beslis:** ✅ / ❌

---

## Rule 8 — `shared/schemas.md`

```yaml
alwaysApply: false
paths: packages/shared/**/*.ts
```

| Jankurai | Regel |
|----------|-------|
| `Contract and boundary integrity` (score −30) | Schema eerst; export via `index.ts`; foutcodes in `errors.ts` |
| Arch rule 6 | Wijziging hier ⇒ API + web types volgen |

**Beslis:** ✅ / ❌

---

## Rule 9 — `web/ui.md`

```yaml
alwaysApply: false
paths: apps/web/**/*.tsx,apps/web/**/*.css,apps/web/tailwind.config.ts
```

| Jankurai / review | Regel |
|-------------------|-------|
| HLT-013-RENDERED-UX-GAP | Geen Storybook/E2E-lane (bekend gap) — minimaal: tokens, primitives, a11y |
| HLT-031 (`GoedkeurenClient.tsx`) | Geen ongevalideerde casts op API-data |
| Design system | `bg-accent`, geen raw hex; primitives uit `components/ui/` |
| Register | Ouder-dashboard = kalm/neutraal (niet kid-palette op dashboard) |

**Overlap:** skill `design-system` — rule = harde “nooit”-lijst; skill = playbook.

**Beslis:** ✅ / ❌ / ⚠️ alleen skill.

---

## Rule 10 — `web/bff.md`

```yaml
alwaysApply: false
paths: apps/web/app/api/**/*.ts,apps/web/lib/api/**/*.ts,apps/web/lib/auth/**/*.ts
```

| Jankurai | Regel |
|----------|-------|
| HLT-006-DIRECT-DB-WRONG-LAYER (`route.ts` proxy) | BFF proxy alleen — geen D1/SQL; `API_BASE_URL` server-only |
| Review (verified-good) | Tokens in `httpOnly` cookies; proxy `no-store`; geen `NEXT_PUBLIC_` API URL |

**Beslis:** ✅ (sterk aanbevolen — Jankurai false positive op proxy als “DB layer”) / ❌

---

## Rule 11 — `web/i18n.md`

```yaml
alwaysApply: false
paths: apps/web/messages/**/*.json,apps/web/i18n/**/*.ts
```

| TaakHelden | Regel |
|------------|-------|
| Tone | NL user strings; kindteksten positief (`@dutch-child-copy`) |
| Keys | Zelfde structuur `nl.json` / `en.json` |

**Beslis:** ✅ / ❌ / samenvoegen met `ui.md`.

---

## Rule 12 — `ios/swift.md`

```yaml
alwaysApply: false
paths: apps/ios/**/*.swift,apps/ios/**/*.strings
```

| Jankurai | Regel |
|----------|-------|
| HLT-004 (`apps/ios/README.md`) | OpenAPI sync via `Scripts/sync-openapi-contract.sh` |
| Product | Kind-register; geen child PII |

**Beslis:** ✅ / ❌ (iOS nog dun — rule kan minimaal blijven).

---

## Rule 13 — `ops/ci-and-agent.md`

```yaml
alwaysApply: false
paths: .github/workflows/**/*.yml,.github/workflows/**/*.yaml,.claude/**/*,agent/**/*
```

| Jankurai finding (high volume) | Regel |
|--------------------------------|-------|
| HLT-034-CI-BAD-BEHAVIOR | Actions pin op volledige commit-SHA |
| HLT-042-CI-LOCAL-PARITY | Wijziging workflow ⇒ lokale parity (`npm test` minimaal) |
| `no-jankurai-audit-lane-in-ci` | `.github/workflows/jankurai.yml` bestaat — niet verwijderen |
| `agent-tool-supply-chain-gap` | `.claude/` wijzigingen reviewen; hooks blijven actief |
| Missing `ops/ci/*.sh` | **Niet** fake `ops/` toevoegen alleen voor score — documenteer bewuste keuze |

**Beslis:** ✅ / ❌ / ⚠️ alleen voor `.github/` (agent/ apart).

---

## Rule 14 — `ops/generated-zones.md`

```yaml
alwaysApply: false
paths: target/jankurai/**/*,agent/baselines/main.repo-score.json
```

| Jankurai | Regel |
|----------|-------|
| `generated-zone-mutation-risk` | Niet handmatig editen; baseline refresh via gedocumenteerd commando in `agent/baselines/README.md` |
| `agent/generated-zones.toml` | `target/jankurai/` is generated |

Uitzondering: `target/jankurai/taakhelden-code-review.md` is handgeschreven review.

**Beslis:** ✅ / ❌

---

## Rule 15 — `docs/markdown.md`

```yaml
alwaysApply: false
paths: docs/**/*.md,AGENTS.md,CLAUDE.md
```

| Jankurai | Regel |
|----------|-------|
| `missing-agent-readable-docs` | API-contract leidend: `docs/taakhelden-api-specificatie.md` |
| HLT-025 release readiness | `docs/release.md` bij release-wijzigingen |
| F7 | Documenteer “geen directe browser→Worker CORS” |

**Beslis:** ✅ / ❌

---

## Wat we **niet** in rules zetten (Jankurai false positives / N/A)

| Finding | Reden |
|---------|-------|
| Qesto-stack (Stripe, Vectorize, Workers AI) | Niet in TaakHelden — zie review §N/A |
| `ops/ci/lib.sh`, `scripts/ci-local.sh` | Jankurai reference-profile; bewuste monorepo-layout |
| `reference-profile cell ops at .github/` | Ops leeft in `.github/` + npm scripts |
| Design System/ heuristics | Uitgesloten in `agent/audit-policy.toml` — niet shippen |
| DO `.stub` als dead marker | Productcode; rule 4 documenteert uitzondering |

---

## Relatie met bestaande `.claude/`

| Bestaand | Voorgestelde actie |
|----------|-------------------|
| `skills/COMMON_RULES.md` | Blijft — rules **verfijnen per pad**, niet dupliceren |
| `skills/design-system` | Blijft — `web/ui.md` = harde grenzen |
| `skills/endpoint-scaffold` | Blijft — `api/routes.md` = checklist |
| `hooks/guard-route-sql.mjs` | Blijft — rule is advisory backup |
| `hooks/block-migration-edit.mjs` | Blijft — rule legt uit waarom |
| `agents/*.md` | Blijft — rules zijn **niet** agent-definities |

**Beslis:** rules **importeren** `@.claude/skills/COMMON_RULES.md`? (extra context) vs. alleen verwijzen.

---

## Implementatiestappen (na jouw besluit)

1. Akkoord op subset van rules + lazy vs eager frontmatter.
2. Rule-bestanden aanmaken (target &lt; 80 regels per file).
3. Optioneel: `README.md` index + update `agent/owner-map.json` met `.claude/rules/`.
4. Optioneel: `CLAUDE.md` verkorten — verwijs naar rules i.p.v. herhalen.
5. Baseline: geen Jankurai-score-impact verwacht (rules zijn agent-instructies, geen productcode).

---

## Beslisboom — drie pakketten

| Pakket | Rules | Context-impact | Jankurai-dekking |
|--------|-------|----------------|------------------|
| **A — Minimaal** | `workflow`, `api/routes`, `api/repo`, `web/bff`, `migrations` | Laag | Arch 1–6, F1–F2, HLT-006, HLT-031 repo |
| **B — Aanbevolen** | A + `services-and-do`, `api/tests`, `shared/schemas`, `web/ui`, `generated-zones` | Medium | + UX gap, secrets in tests, contracts |
| **C — Volledig** | Alle 15 rules + subdirs | Hoger | + CI/agent, i18n, ios, docs |

**Gekozen:** **C — Volledig** (alle rules, subdirectories, lazy frontmatter).

| Rule | Bestand | Status |
|------|---------|--------|
| workflow | `always/workflow.md` | ✅ |
| api routes | `api/routes.md` | ✅ |
| api repo | `api/repo.md` | ✅ |
| services/DO | `api/services-and-do.md` | ✅ |
| middleware | `api/middleware.md` | ✅ |
| migrations | `api/migrations.md` | ✅ |
| api tests | `api/tests.md` | ✅ |
| shared | `shared/schemas.md` | ✅ |
| web ui | `web/ui.md` | ✅ |
| web bff | `web/bff.md` | ✅ |
| web i18n | `web/i18n.md` | ✅ |
| ios | `ios/swift.md` | ✅ |
| ci/agent | `ops/ci-and-agent.md` | ✅ |
| generated | `ops/generated-zones.md` | ✅ |
| docs | `docs/markdown.md` | ✅ |
| index | `README.md` | ✅ |
