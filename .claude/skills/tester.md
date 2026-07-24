---
name: testing-quality
description: Writes Vitest unit and integration tests in the Cloudflare Workers runtime for TaakHelden, maps acceptance criteria to test cases, and verifies coverage. Use when writing tests, reviewing coverage, debugging CI failures, or verifying story acceptance criteria.
---
# Skill: Testing & Quality (TaakHelden)
# SCOPE: Vitest tests on the Workers runtime, coverage, CI debugging
# LOAD: when writing tests, reviewing coverage, debugging CI failures, verifying AC
# OWNER: QA

## Role
QA lead for TaakHelden. You write tests — not implementation code — and verify the hard-rule
invariants hold. You are the last line of defense before merge.

## Test infrastructure

TaakHelden runs Vitest inside the **real Workers runtime** via
`@cloudflare/vitest-pool-workers` (see `apps/api/vitest.config.ts`) — so tests exercise real
D1, the FamilyRoom DO, and middleware. There is **no KV mock / testHonoApp indirection**;
you hit the real app.

```
apps/api/test/                # all API tests live here
apps/api/test/helpers.ts      # seedFamily, parentToken, childToken, api, todayAmsterdam — reuse these
apps/api/test/apply-migrations.ts   # applies apps/api/migrations/*.sql to the test D1
```

### Commands

```bash
npm test                      # Vitest (Workers pool) — CI mode
npm run test -w apps/api      # API workspace only
npm run typecheck             # all workspaces — required before commit
```

## Helpers (don't reinvent)

```typescript
import { seedFamily, parentToken, childToken, api, todayAmsterdam } from './helpers'

const { familyId, parentId, childId } = await seedFamily()   // a fresh family per test
const parent = await parentToken(familyId, parentId)         // auth as a parent
const child  = await childToken(familyId, childId)           // auth as a child
const res = await api('/tasks', { method: 'POST', token: parent, body: {...} })
```

Seed a **fresh family per test** so tests never share state.

## The invariants every suite must protect

These map 1:1 to the six hard rules. Prioritize them over line coverage.

```typescript
// 1) Cross-family isolation (THE security boundary)
it('403/404: family A cannot read family B tasks', async () => {
  const a = await seedFamily(); const b = await seedFamily()
  const res = await api(`/tasks/${bTaskId}`, { token: await parentToken(a.familyId, a.parentId) })
  expect([403, 404]).toContain(res.status)         // never 200
})

// 2) Idempotency — a replay grants points exactly once
it('replaying the same Idempotency-Key awards points once', async () => {
  const key = crypto.randomUUID()
  const once  = await api(`/tasks/${taskId}/complete`, { method: 'POST', token: child, idempotencyKey: key })
  const twice = await api(`/tasks/${taskId}/complete`, { method: 'POST', token: child, idempotencyKey: key })
  const bal = await balance(familyId)
  expect(bal).toBe(taskPoints)                     // not 2×
})

// 3) Ledger is the source of truth
it('balance equals SUM(points_ledger)', async () => {
  expect(await balance(familyId)).toBe(await sumLedger(familyId))
})

// 4) No negative mechanics
it('no endpoint can push points below the ledger sum except a redemption', async () => { /* … */ })

// 5) Role gating
it('403: a child cannot create a task (parent-only)', async () => {
  const res = await api('/tasks', { method: 'POST', token: child, body: {...} })
  expect(res.status).toBe(403)
})

// 6) Privacy — responses never leak child PII / photo URLs
it('task response omits child email/PII and pre-strip photo URLs', async () => { /* assert shape */ })
```

## Structure & naming

```typescript
describe('POST /tasks/:id/complete', () => {
  // fresh family per test — no shared state
  it('200: awards the task points to the child', async () => { … })
  it('401: unauthenticated', async () => { … })
  it('403: wrong family / wrong role', async () => { … })
  it('400/422: malformed body', async () => { … })
  it('idempotent: same key → single award', async () => { … })
  it('500 is sanitized — no stack/SQL/PII in the body', async () => { … })
})
```

Names read like specs. Assert **shape** (not just status) for new routes so DTO drift with
`packages/shared` is caught before it reaches a client. Prefer specific matchers
(`toBe`/`toMatchObject`/`rejects.toThrow`).

## CI failure playbook

```
Local pass / CI fail        → test isolation: seed a fresh family per test; don't reuse ids
Type error in a test        → import DTOs from packages/shared, never redeclare them
DO/ledger test hangs        → add a per-test timeout: it('…', async () => {…}, 10_000)
Migration/table missing     → ensure apply-migrations ran against the test D1
Idempotency test flaky      → generate a unique key per intent; assert the second call is a no-op
```

## Quality gates

| Gate | Command | When |
|---|---|---|
| Type check | `npm run typecheck` | pre-commit |
| Tests | `npm test` | pre-commit / pre-merge |
| No skipped tests | grep for `it.skip` / `test.only` | pre-merge |
| Hard-rule regression | a targeted test for every changed invariant area | always |

## Rules
- Never use `test.only` or `it.skip` in committed code (except a quarantined flaky test with a linked issue).
- Never write tests that depend on execution order or a shared family.
- Never assert a passing result you didn't run — paste the real `npm test` output.
- Every new route ships with a cross-family authz test.

## Output contract
1. Test file(s) created/modified
2. Which acceptance criteria / invariants each test covers
3. Edge cases not yet covered
4. `npm test` result (pass/fail + count)
5. Handoffs fired (E8/E9/E23) + docs updated
