---
description: Controleert of de huidige wijzigingen de juiste testniveaus dekken (unit/system/E2E) volgens de teststrategie.
---

Volg `.claude/skills/test-strategy/SKILL.md` en beoordeel de huidige wijzigingen.

Scope: `git diff main...HEAD` plus unstaged (`git diff`). Als ik specifieke bestanden noem,
beperk je daartoe: $ARGUMENTS

## Stappen

1. **Classificeer de wijziging** — API-route, BFF, shared schema, UI-flow, DO/ledger, migratie?
2. **Bepaal vereiste niveaus** — gebruik de beslisboom uit de teststrategie.
3. **Inventariseer bestaande tests** — welke suites dekken dit al (`apps/api/test/`,
   `apps/web/**/*.test.ts`, `tests/e2e/`)?
4. **Gap-analyse** — ontbrekende authz, idempotency, contract, E2E happy path?
5. **Uitvoering** — welke commando's zijn het meest efficiënt voor deze diff?
   (zie `references/execution-matrix.md`)

## Rapportformaat

### Wijzigingssamenvatting
Kort wat er gewijzigd is.

### Vereiste testniveaus
| Niveau | Vereist? | Reden |
|--------|----------|-------|
| Unit | ja/nee | … |
| System | ja/nee | … |
| E2E | ja/nee | … |
| Contract (openapi) | ja/nee | … |

### Dekking
| Invariant / AC | Gedekt door | Status |
|----------------|-------------|--------|
| … | `bestand:regel` of — | ✅ / ⚠️ / ❌ |

### Aanbevolen commando's (efficiënt)
```bash
# minimale set voor deze diff
```

### Go / no-go
- **Go** als alle verplichte niveaus gedekt zijn (of bewust uitgesteld met issue).
- **No-go** als een nieuwe route geen authz-test heeft, of een mutatie geen idempotency-test.

Roep `@taakhelden-tester` aan voor ontbrekende system/unit-tests, `@taakhelden-e2e` voor
E2E/load/stress/a11y.
