---
alwaysApply: false
paths: apps/api/test/**/*.ts
---

# API tests (`apps/api/test/`)

Vitest in the **Workers runtime** (`@cloudflare/vitest-pool-workers`). Tests are proof
lanes for API changes — required for new routes and authz boundaries.

## Helpers — use them (HLT-010)

- `seedFamily`, `parentToken`, `childToken`, `api`, `todayAmsterdam` from `helpers.ts`.
- Do not embed real secrets, production JWT secrets, or live credentials in tests.
- Use test env from the vitest pool; copy patterns from `authz.test.ts`.

## Required coverage for new routes

- Cross-family access denied (403/404).
- Role violations (child vs parent) denied where applicable.
- Idempotency: duplicate `Idempotency-Key` does not double-apply ledger effects.

## Input boundary regressions (F1)

- Malformed pagination cursors → `400 VALIDATION_FAILED`, not `500`.
- Add explicit tests when decoding user-controlled opaque tokens.

## What to avoid

- Tests that hit real Cloudflare (all storage is Miniflare-emulated).
- Logging child names or photo URLs in failure output.
- Skipping authz tests for "read-only" endpoints that still leak cross-family data.

## Proof lane

```bash
npm test
# or scoped:
npm run test -w apps/api
```

Paste real output in PR descriptions — do not claim green without running.
