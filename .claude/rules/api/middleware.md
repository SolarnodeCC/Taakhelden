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

- Cache key: `(userId, Idempotency-Key)`, plus a fingerprint over method + path + query +
  body. Same key **and** same fingerprint → the cached response (a real retry). Same key,
  different fingerprint → `409 IDEMPOTENCY_KEY_REUSED`.
- It used to be key-only, so reusing one key across endpoints returned the first response
  with HTTP 200 — the second mutation silently never ran. See audit finding 6.
- The DO applies the same rule authoritatively (`idempotency_keys.fingerprint`, migration
  0010); KV stays the fast path.
- Behaviour is documented in `docs/taakhelden-api-specificatie.md` — keep them in step.
- `requireIdempotencyKey` vs optional `idempotency`: ledger mutations must use `require`.

## Validation (`middleware/validate.ts`)

- Bridge to Zod schemas in `packages/shared` — do not define request shapes here.

## Rate limiting (`middleware/ratelimit.ts`)

- PIN lockout and abuse paths use KV with explicit TTLs (`pinfail:*`, etc.).

## Errors (`middleware/error.ts`)

- Map `ApiException` to consistent JSON; malformed client input → `400`, not `500`.
- User-facing API errors: Dutch where appropriate; child-facing copy stays positive.

## Changes checklist

- [ ] No new SQL in middleware (repo layer only).
- [ ] KV entries set TTL where applicable.
- [ ] Auth changes reviewed with `@taakhelden-security` for cross-family impact.
