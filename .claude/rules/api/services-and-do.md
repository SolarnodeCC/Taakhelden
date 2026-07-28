---
alwaysApply: false
paths: apps/api/src/services/**/*.ts,apps/api/src/do/**/*.ts,apps/api/src/jobs/**/*.ts
---

# API services, Durable Object, and jobs

Business logic that spans repos, external services (R2, APNs, Apple), or needs per-family
serialization lives here — not in routes.

## FamilyRoom DO (arch rules 2–3)

- Ledger writes and idempotent mutations run inside the DO turn (`do/FamilyRoom.ts`).
- Authoritative idempotency dedup: KV is a fast path; DO does check + `INSERT OR IGNORE` on
  `idempotency_keys` so concurrent requests cannot double-book.
- Balance is always `SUM(points_ledger)` via `repo/ledger.ts` — no stored balance field.

## No negative mechanics (arch rule 4)

- `applyAdjust` rejects `amount <= 0`. Negative ledger amounts only for `redemption` and
  `redemption_cancel`. No penalties or undo-debit paths.

## Dead markers (HLT-001)

- No `TODO`, `FIXME`, `not implemented`, or placeholder stubs in shipping paths.
- **Jankurai false positive:** Durable Object client calls like `.stub()` are real product
  code — not unfinished stubs. Do not rename or remove them to satisfy heuristics.

## Photos and secrets (F3)

- Presigned photo URLs: prefer a dedicated `PHOTO_URL_SECRET` binding over reusing
  `JWT_SECRET`. Short TTLs; never log URLs.
- Photos only served at status `ready` (after EXIF strip in `jobs/photoConsumer.ts`).

## Jobs and cron

- `jobs/cron.ts`: housekeeping (`purgeOldIdempotencyKeys`, `purgeExpiredAccounts`).
- Queue consumers: fail closed on privacy paths (delete object if EXIF strip fails).

## Workers runtime

- No Node APIs: no `fs`, `Buffer`, `process.env` — use `c.env` / `env` bindings.
- No `console.log` of PII; log `err.message` only when unavoidable.

## Sync / WebSocket routes

- `routes/sync.ts`, `routes/ws.ts`, `services/familyRoom.ts` are production paths — keep
  them complete and tested; do not leave partial implementations.
