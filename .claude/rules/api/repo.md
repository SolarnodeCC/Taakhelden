---
alwaysApply: false
paths: apps/api/src/repo/**/*.ts
---

# API repo layer (`apps/api/src/repo/`)

The repo layer is the **security boundary** for D1. Every function here is family-scoped.

## `familyId` first (arch rule 1)

- Signature: `(db, familyId, …)` or equivalent — `familyId` immediately after the DB handle.
- Every query includes `family_id = ?` (or joins through family-scoped rows).
- Never expose a query that can return another family's rows.

## SQL safety (HLT-023, untrusted input)

- Values always bound via `?` placeholders — never concatenate user input into SQL.
- Dynamic column lists: whitelist allowed names; build `?` placeholders only from that list.
  Follow patterns in `updateTask`, `listEntries`, `dayStats`.
- No shell commands built from request strings.

## Type boundaries (HLT-031, F5)

- Do not use `as unknown as <Row>` on D1 results.
- Parse rows through shared Zod schemas or a dedicated row-mapper in `repo/`.
- Schema drift must fail at the boundary, not at runtime deep in handlers.

## What belongs here

- All D1 reads/writes for a resource.
- ID generation via `newId("<prefix>")` from `services/ids.ts` when creating rows.

## What does not belong here

- HTTP/request logic, JWT parsing, or Hono context.
- Ledger writes that need DO serialization — those are invoked from routes/services/DO,
  but the SQL for ledger rows still lives in `repo/ledger.ts`.

## Verification

```bash
rg -n 'as unknown as' apps/api/src/repo/
rg -n 'family_id' apps/api/src/repo/<file>.ts
```

New repo files must show `family_id` filters on every query path.
