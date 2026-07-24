---
name: developing-backend
description: Implements Hono API routes, the D1 repo layer, the FamilyRoom Durable Object, idempotency, and the ledger for TaakHelden on Cloudflare Workers. Use when working on apps/api/ or packages/shared schemas. See backend-integrations.md for Apple/Turnstile/R2/email, backend-perf.md for performance budgets.
---
# Skill: Backend Development (TaakHelden)
# SCOPE: Hono routes, D1 repo layer, FamilyRoom DO, idempotency, ledger, integrations
# LOAD: when working on apps/api/, packages/shared schemas, migrations
# OWNER: Backend Lead

## Role
Senior backend developer. You own the Hono API, the D1 repo layer, the FamilyRoom Durable
Object, and external integrations. You write edge-compatible TypeScript with no Node.js-only
APIs. The web and iOS clients consume you only through the `packages/shared` Zod contract.

## Preconditions / Inputs
- Route/handler to implement + the resource it belongs to
- Zod schema in `packages/shared` (add the field there first)
- Any schema change ⇒ a **new** numbered migration (never edit an old one)
- Whether the change touches points (⇒ ledger via FamilyRoom DO)

## Workflow

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

**No Node.js APIs**: no `fs`, no `Buffer` (use `Uint8Array`), no `process.env` (use `c.env`).
**Integrations / performance**: See [backend-integrations.md](backend-integrations.md) · [backend-perf.md](backend-perf.md)

The four layers of every endpoint (from `CLAUDE.md` → Workflow, and the `endpoint-scaffold`
skill): **Zod schema in `packages/shared` → repo function (`familyId`-first) → Hono route
(repo calls only) → authz test.** Skip none.

## Hard-Rule Backend Gates

Apply before implementation:

- Route handlers do only HTTP concerns: validate (Zod), authorize, call a repo/service, respond.
- **All SQL lives in `apps/api/src/repo/`.** A route never contains `.prepare(` / `.batch(`.
- Every repo function takes `familyId` as the first argument after the DB handle; every query
  filters `family_id = ?`. No exceptions — this is the security boundary.
- Every mutation (POST/PATCH/DELETE) runs through `middleware/idempotency.ts`.
- Point changes go through the FamilyRoom DO into `points_ledger`. Never update a balance column.
- Malformed input returns 400/422 (Zod), never a 500. Catch blocks sanitize and log without PII.
- Schema changes ship as a new `apps/api/migrations/NNNN_*.sql`; never patch schema at request time.
- New D1/repo logic gets tests: happy path, missing resource, cross-family denial, malformed input.

## Route Pattern

```typescript
import { Hono } from 'hono'
import { requireParent } from '../middleware/authz'
import { validate } from '../middleware/validate'
import { idempotent } from '../middleware/idempotency'
import { CreateTaskSchema } from '@taakhelden/shared'
import * as tasksRepo from '../repo/tasks'
import type { Env } from '../types'

export const tasks = new Hono<{ Bindings: Env }>()

// Read — familyId comes from the authz middleware, never from the client body
tasks.get('/', async (c) => {
  const familyId = requireParent(c)          // throws 401/403 if not a parent of a family
  return c.json(await tasksRepo.listTasks(c.env.DB, familyId))
})

// Mutation — idempotent + Zod-validated; route calls only the repo
tasks.post('/', idempotent, validate('json', CreateTaskSchema), async (c) => {
  const familyId = requireParent(c)
  const body = c.req.valid('json')
  return c.json(await tasksRepo.createTask(c.env.DB, familyId, body), 201)
})
```

## Repo Pattern (all SQL lives here)

```typescript
// apps/api/src/repo/tasks.ts — familyId is ALWAYS the first arg after the DB handle
import { newId } from '../services/ids'

export async function listTasks(db: D1Database, familyId: string) {
  const { results } = await db
    .prepare('SELECT * FROM tasks WHERE family_id = ? ORDER BY created_at DESC')
    .bind(familyId)                        // every query filters family_id = ?
    .all()
  return results
}

export async function createTask(db: D1Database, familyId: string, input: CreateTaskInput) {
  const id = newId('task')
  await db
    .prepare('INSERT INTO tasks (id, family_id, title, points, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, familyId, input.title, input.points, new Date().toISOString())
    .run()
  return { id, ...input }
}
```

## Error / validation contract

- Requests and responses are validated with the Zod schemas in `packages/shared`.
- Error codes come from `packages/shared/src/errors.ts` (`ErrorCodes`) — surfaced via
  `middleware/error.ts`. Never return a raw `err.message`, SQL text, or stack trace to a client.
- Malformed JSON / schema failure ⇒ 400/422. Not found ⇒ 404. Cross-family / wrong role ⇒ 403/404.

## FamilyRoom Durable Object (the ledger boundary)

```typescript
// One DO per family; it serializes ledger writes so points can never diverge.
// Reach it through services/familyRoom.ts — routes don't construct DO stubs ad hoc.
import { awardPoints } from '../services/familyRoom'

// Awarding points for a completed task — idempotent, serialized, ledger-only
await awardPoints(c.env, familyId, {
  idempotencyKey: c.req.header('Idempotency-Key')!,
  childId, taskId, points,           // written as a points_ledger row, never a balance column
})
```

- Balance is **always** `SELECT SUM(points) FROM points_ledger WHERE family_id = ?` (see `repo/ledger.ts`).
- No negative mechanics: a ledger debit only ever represents a reward redemption or its cancellation.

## Idempotency

Every mutation passes through `middleware/idempotency.ts`, keyed by the `Idempotency-Key`
header. Replaying the same key returns the first result and performs the side effect once.
Ticking off a task twice, or a client retry after a dropped response, must never double-award.

## Workers best practices

```typescript
// Background work after responding
c.executionCtx.waitUntil(notifier.push(env, familyId, event))

// Cryptographically secure ids/tokens — never Math.random()
const bytes = new Uint8Array(32); crypto.getRandomValues(bytes)

// Regenerate Env types after adding a binding: npx wrangler types
```

## Checklist before submitting
- [ ] Route mounted in `apps/api/src/index.ts`?
- [ ] Authz applied (`requireParent` / role check) and `familyId` never taken from the body?
- [ ] All SQL in `repo/`, every query filters `family_id = ?`?
- [ ] Mutation is idempotent?
- [ ] Point change goes through the FamilyRoom DO into `points_ledger` (no balance column)?
- [ ] Input validated against a `packages/shared` schema (400/422 on bad data)?
- [ ] Schema change is a NEW numbered migration?
- [ ] New secret via `wrangler secret put` (NOT `wrangler.toml`)?
- [ ] Authz test covers cross-family denial + role gating?
- [ ] External calls have a timeout/retry/degradation posture?
- [ ] `npm test` and `npm run typecheck` pass? `/arch-check` clean?

## Docs to Update
| Change | Doc |
|---|---|
| New/modified HTTP routes or WS message types | `docs/taakhelden-api-specificatie.md` |
| New migration, DO protocol, or R2 usage | `docs/taakhelden-cloudflare-github-architectuur.md` |
| New secret or env binding | `docs/taakhelden-cloudflare-github-architectuur.md` + `CLAUDE.md` |
