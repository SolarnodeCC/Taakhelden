---
alwaysApply: false
paths: apps/api/src/routes/**/*.ts
---

# API routes (`apps/api/src/routes/`)

Hono route handlers only orchestrate auth, validation, and repo/DO calls. See skill
`endpoint-scaffold` for full templates; this file is the **hard checklist**.

## Never in routes (arch rule 1, HLT-006)

- No `.prepare(`, `.exec(`, `.batch(` on D1.
- No SQL keywords in strings (`SELECT`, `INSERT INTO`, `UPDATE`, `DELETE FROM`).
- PostToolUse hook `guard-route-sql.mjs` warns on violations.

All SQL lives in `apps/api/src/repo/` with `familyId` as the first argument after the DB
handle.

## Input validation (arch rule 6, HLT-031)

- Mutations: `validate("json", <Schema>)` with schemas from `packages/shared`.
- User-controlled opaque tokens (pagination cursors, etc.): decode in try/catch; on failure
  throw `400 VALIDATION_FAILED` — never let `atob` / `JSON.parse` throw to `500` (F1).
- Validate decoded shapes with a small Zod schema before use.

## Idempotency (arch rule 2, F2)

- Ledger-writing mutations (`adjust`, `redeem`, `complete`, etc.): use
  `requireIdempotencyKey` — not optional `idempotency` alone.
- Point mutations that touch the ledger go through the FamilyRoom DO.

## Auth and transport

- Use `requireParent` / `requireChild` / authz middleware from `middleware/authz.ts`.
- **No CORS middleware** (F7). Browser clients use the Next.js BFF; iOS is native. Do not
  add `Access-Control-Allow-Origin` with credentials.

## Logging and privacy (arch rule 5)

- Never log names, e-mail, or photo URLs.
- Avoid `console.*` in routes; use structured error handling via `middleware/error.ts`.

## Verification

```bash
rg -n '\.prepare\(|\.batch\(' apps/api/src/routes/
rg -n 'JSON\.parse|atob\(' apps/api/src/routes/
```

Both should return nothing new without accompanying validation.
