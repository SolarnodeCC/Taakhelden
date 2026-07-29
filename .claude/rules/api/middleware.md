---
alwaysApply: false
paths: apps/api/src/middleware/**/*.ts
---

# API middleware

Middleware runs on every matching request — keep it fast, side-effect aware, and safe.

## Authentication (`middleware/auth.ts`)

- JWT: HS256 via `jose` with symmetric key from `c.env.JWT_SECRET`.
- Reject ws-typed tokens on the REST API path.
- Apple Sign-in: verify issuer + audience against Apple's JWKS (`services/apple.ts`).

## Idempotency (`middleware/idempotency.ts`, F6)

- Cache key: `(userId, Idempotency-Key)` — **not** scoped to path or body.
- This matches common client contracts: reusing one key across different endpoints returns
  the first cached response. Document in `docs/taakhelden-api-specificatie.md` when
  changing behavior.
- `requireIdempotencyKey` vs optional `idempotency`: ledger mutations must use `require`.

## Validation (`middleware/validate.ts`)

- Bridge to Zod schemas in `packages/shared` — do not define request shapes here.

## Rate limiting (`middleware/ratelimit.ts`)

- **Abuse ceilings (auth):** KV fixed-window today — known non-atomic MVP gap.
  Successor: Workers Rate Limiting API — see `docs/atomic-rate-limiting-plan.md`
  and ADR-0005. Do not “fix” with a smarter KV counter.
- **Exact counters stay on KV:** PIN lockout (`pinfail:*`), photo day-quota, etc.
  Those need accounting semantics; the Rate Limiting API is permissive/colo-local.

## Errors (`middleware/error.ts`)

- Map `ApiException` to consistent JSON; malformed client input → `400`, not `500`.
- User-facing API errors: Dutch where appropriate; child-facing copy stays positive.

## Changes checklist

- [ ] No new SQL in middleware (repo layer only).
- [ ] KV entries set TTL where applicable.
- [ ] Auth changes reviewed with `@taakhelden-security` for cross-family impact.
