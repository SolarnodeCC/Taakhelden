---
name: optimising-backend-performance
description: Performance budgets, latency targets, and optimization patterns for the TaakHelden backend. Use when reviewing performance impact of backend changes, diagnosing latency regressions, or optimizing D1 / FamilyRoom-DO access patterns.
---

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

Referenced from [backend-dev.md](backend-dev.md). Load when diagnosing or preventing
performance regressions.

## Latency Targets

| Component | Metric | Target |
|---|---|---|
| D1 | Indexed query | < 50ms p95 |
| D1 | Table scan (no index) | < 500ms max |
| Ledger sum (`SUM(points)` over `points_ledger`) | Indexed on `family_id` | < 50ms p95 |
| FamilyRoom DO | Cold start to first message | < 100ms |
| R2 | Presign + metadata | < 50ms |

## Measurement

```typescript
console.time('ledger-sum')
const balance = await ledgerRepo.balance(c.env.DB, familyId)
console.timeEnd('ledger-sum')   // "ledger-sum: 4.1ms"
```

Every PR touching hot paths includes a short performance note (before/after p95).

## Optimization Patterns

**Avoid N+1 D1 calls — batch:**
```typescript
// ❌ Sequential per child
for (const id of childIds) await repo.getChild(db, familyId, id)
// ✅ One query, filtered by family
await repo.listChildren(db, familyId)      // WHERE family_id = ? AND id IN (...)
```

**Index every `family_id` (and hot WHERE) column:**
```sql
CREATE INDEX IF NOT EXISTS idx_ledger_family ON points_ledger(family_id);
CREATE INDEX IF NOT EXISTS idx_tasks_family  ON tasks(family_id);
```

**Cache DO state in memory (guard the init promise):**
```typescript
private cached: FamilyState | null = null
async load() { if (!this.cached) this.cached = await this.state.storage.get('state'); return this.cached }
// A storage read failure must clear the cached promise so a later call retries.
```

**Ledger is append-only + summed** — don't recompute the whole history on every read if a
family's ledger grows large; consider a bounded read or periodic snapshot **without ever
introducing a stored balance column that could diverge** (hard-rule #3).

**Do enrichment after responding:**
```typescript
c.executionCtx.waitUntil(notifier.push(env, familyId, event))   // don't block the response
```

## Resilience budgets

| Dependency | Gate |
|---|---|
| FamilyRoom DO storage | Guard cached-promise init; a storage failure must not poison later requests. |
| D1 in auth/authz middleware | Keep indexed + bounded; catch failures with explicit fail-open/closed semantics. |
| Apple / Turnstile / R2 / email | Bounded timeout + a degradation decision; never leave a request hanging. |

Flag any new route or integration that cannot state its timeout/degradation behavior.
