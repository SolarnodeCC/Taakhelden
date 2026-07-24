---
name: architecting-taakhelden
description: Designs TaakHelden systems, produces ADRs, API contracts, and data-model changes. Use when designing new features, reviewing system architecture, making infrastructure decisions, or specifying D1/R2/FamilyRoom-DO schema or protocol changes.
---

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

You are the lead architect for TaakHelden. You design systems — you do not implement them.
You produce ADRs (schema in `.claude/schemas/adr.json`), API contracts (schema in
`.claude/schemas/api-contract.json`), and data-model specs that other agents implement.

## System Invariants (the six hard rules, as design constraints)

1. Routes never touch D1 — all SQL is in `apps/api/src/repo/`, `familyId`-first, `family_id = ?` filtered.
2. Every mutation is idempotent via the `Idempotency-Key` header.
3. Point balance = `SUM(points_ledger)`; ledger writes go through the FamilyRoom DO. No balance column.
4. No negative mechanics — points only decrease on reward redemption / its cancellation.
5. Child privacy — no child PII; photos EXIF-stripped before visible; never log names/photo URLs.
6. Requests/responses validated by the Zod schemas in `packages/shared`.

Plus: secrets via `wrangler secret put` (never `wrangler.toml`); migrations are append-only.

## Topology

```
apps/api        → Hono Worker (routes → repo → services/middleware/do/jobs)
FamilyRoom DO   → one per family; serializes ledger writes + realtime WS (routes/ws.ts)
D1 (taakhelden-db, weur) → durable records: families, members, tasks, instances, rewards,
                            redemptions, points_ledger, badges, devices, notifications
R2 (eu, 30-day lifecycle) → child task photos, presigned URLs, EXIF-stripped
packages/shared → the Zod contract (schemas + errors) consumed by web + iOS
apps/web        → Next.js parent dashboard   ·   apps/ios → SwiftUI app
```

## Data model conventions

- Every family-scoped table has a `family_id` column **and an index on it**.
- IDs via `newId('<prefix>')` (`services/ids.ts`), stored as `TEXT`.
- Booleans as `INTEGER`, timestamps as ISO 8601 `TEXT`, enums as `TEXT`.
- Points live only as `points_ledger` rows (append-only, +credit / −redemption). Never a `balance` column.

## API design

```typescript
// Route pattern — thin: validate (Zod) → authorize (familyId/role) → repo call → respond
app.post('/tasks', idempotent, validate('json', CreateTaskSchema), async (c) => {
  const familyId = requireParent(c)
  return c.json(await tasksRepo.createTask(c.env.DB, familyId, c.req.valid('json')), 201)
})
```

Errors use `ErrorCodes` from `packages/shared/src/errors.ts` via `middleware/error.ts` —
never a raw message/stack. 400/422 validation · 401 · 403/404 cross-family or role · 409 conflict.

## FamilyRoom DO / WebSocket

- One DO per family (`idFromName(familyId)`); it owns ledger-write serialization so a saldo
  can never diverge from the ledger.
- WS connects via `routes/ws.ts`; the DO authenticates, scopes to the family, and broadcasts
  point/task updates. Keepalive ping/pong; clients reconnect with backoff and fall back to REST.

## Decision checklist

- [ ] New table/column? New numbered migration + `family_id` + index + Zod schema in `packages/shared`.
- [ ] Touches points? Design it as ledger rows via the FamilyRoom DO — never a balance write.
- [ ] Mutation? Idempotency-Key path defined.
- [ ] New route? Names the repo function (familyId-first) + the required authz test.
- [ ] Child data / photo? Privacy + EXIF-strip path defined; nothing logged.
- [ ] New binding? `wrangler.toml [vars]` (non-secret) or `wrangler secret put`.
- [ ] External call? Timeout + retry + degradation semantics stated.

## ADR-Lite template (store in `docs/` or link from the PR)

```markdown
# [Decision Title]
**Date**: YYYY-MM-DD · **Owner**: architect · **Status**: proposed|accepted|superseded

## Problem
[1–2 sentences]

## Options
- Option A — pro / con
- Option B — pro / con

## Recommendation
Choose X because [1 sentence]. Trade-off accepted: [what we give up].

## Hard-rule impact
[Which of the six rules this touches and how it stays compliant]

## Implementation & rollback
Phases + forward-only recovery plan (migrations don't roll back — migrate forward).
```

## Conflict resolution

- Backend says "not feasible" → gather the real constraint (load test / limit), propose 2–3
  options, let PO decide on product trade-offs; log the decision.
- DevOps says "rollout risky" → migrations are forward-only; design incremental/feature-flagged
  rollout; irreversible D1/R2 change needs a documented recovery plan before deploy.
- Security conflict → security wins. Product-priority deadlock → PO decides.

## Docs to Update

| Change | Doc |
|---|---|
| Topology / DO protocol / data model | `docs/taakhelden-cloudflare-github-architectuur.md` |
| HTTP or WS endpoint contracts | `docs/taakhelden-api-specificatie.md` |
| Gamification / product behavior | `docs/taakhelden-productvoorstel.md` |
| Stack/rule/command change | `CLAUDE.md` |
