# Cloudflare bindings & secrets audit

_Audit date: 2026-07-28. Baseline: post-#72 (`taakhelden-web` → `API` service binding)._

Live secret **values** are never recorded here. Secret **names** only.
Cloudflare-bindings MCP was unavailable (`needsAuth`); bindings are taken from
successful `wrangler deploy` logs + live HTTP smoke. Re-run
`npx wrangler secret list` after authenticating to confirm secret names on the
account.

Account ID (non-secret): `5546763229b35df670e33d9316d7f2e0`.

---

## `taakhelden-web`

Source: [`apps/web/wrangler.jsonc`](../apps/web/wrangler.jsonc).
Deploy version (merge #72): `3be59f31-a907-4cd7-8301-d9b16f96d844`.

| Type | Name | Expected | Observed |
|---|---|---|---|
| Service binding | `API` | Worker `taakhelden-api` | Bound (deploy log); BFF login → 401 via binding |
| Assets | `ASSETS` | `.open-next/assets` | Bound |
| Var | `API_BASE_URL` | `https://taakhelden-api.oostelaar.workers.dev/v1` | Bound |
| Secrets | — | none | none |

Notes:

- BFF calls the API via `env.API.fetch()` ([`apps/web/lib/api/config.ts`](../apps/web/lib/api/config.ts)).
  Global `fetch()` to another Worker on the same `*.workers.dev` zone fails
  ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)).
- `API_BASE_URL` remains for Request URLs and browser WebSocket URLs only.
- Intermittent BFF `502 UPSTREAM_UNAVAILABLE` was seen shortly after #72 when
  `apiFetch` fell back to global `fetch` without `env.API`. Hardened: never
  global-fetch `*.workers.dev` without the service binding.

Smoke (2026-07-28):

```text
POST /api/auth/login (unknown user) → 401 INVALID_CREDENTIALS  (5/5 after settle)
GET  /nl/login → 200
```

---

## `taakhelden-api`

Source: [`apps/api/wrangler.toml`](../apps/api/wrangler.toml),
[`apps/api/src/types.ts`](../apps/api/src/types.ts).
Deploy version (merge #72): `69aec910-072c-4055-80ef-d788a8a6f27e`.

### Bindings

| Type | Name | Resource | Observed |
|---|---|---|---|
| D1 | `DB` | `taakhelden-db` (`031e773c-…`) | Bound |
| R2 | `PHOTOS` | `taakhelden-photos` (jurisdiction `eu`) | Bound |
| KV | `KV` | `5f1fabd9e81f4fd7843a7cbe8ba5f2ac` | Bound |
| Durable Object | `FAMILY_DO` | class `FamilyRoom` | Bound |
| Queue producer | `PHOTO_QUEUE` | `photo-processing` | Bound (inherited) |
| Queue producer | `EXPORT_QUEUE` | `export-processing` | Bound (inherited) |
| Cron | — | `5 0 * * *`, `*/15 * * * *` | Deployed with triggers |

### Secrets & vars (expected)

| Kind | Name | Required for | Observed (inferred) |
|---|---|---|---|
| Secret | `JWT_SECRET` | All token issue / verify | **MISSING or empty** — `POST /v1/auth/register` → `500 INTERNAL`; login with unknown email still `401` (no token mint) |
| Secret | `TURNSTILE_SECRET` | Bot check on register | Unset → Turnstile skipped (code allows) |
| Secret | `APPLE_CLIENT_ID` | Sign in with Apple | Optional until Apple flow used |
| Secret | `APPLE_BUNDLE_ID` | APNs topic fallback | Optional |
| Secret | `APNS_KEY` / `APNS_KEY_ID` / `APNS_TEAM_ID` | Push | No-op when empty |
| Secret | `EMAIL_API_KEY` / `EMAIL_FROM` | Co-parent invite mail | No-op when empty |
| Var | `APP_BASE_URL` | Invite links in email | Optional |
| Var | `APNS_ENV` | `sandbox` \| `production` | Optional |

Smoke (2026-07-28):

```text
GET  /v1/health → {"ok":true}
POST /v1/auth/login (unknown) → 401 INVALID_CREDENTIALS
POST /v1/auth/register (valid body) → 500 INTERNAL   ← JWT_SECRET gap
```

---

## Gaps & actions

### Critical — set `JWT_SECRET` on the API Worker

```bash
cd apps/api
npx wrangler secret put JWT_SECRET
# paste a long random value (e.g. openssl rand -base64 48)
```

Then re-smoke:

```bash
curl -sS -X POST https://taakhelden-api.oostelaar.workers.dev/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"TestPass123!","displayName":"Test","familyName":"Test","turnstileToken":"dev-bypass"}'
# expect 201 (or 409 if email exists) — not 500
```

Also set when enabling features:

```bash
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put APPLE_CLIENT_ID
npx wrangler secret put APPLE_BUNDLE_ID
npx wrangler secret put APNS_KEY
npx wrangler secret put APNS_KEY_ID
npx wrangler secret put APNS_TEAM_ID
npx wrangler secret put EMAIL_API_KEY
npx wrangler secret put EMAIL_FROM
# optional plain vars:
# npx wrangler secret put is wrong for these — use dashboard vars or wrangler.toml [vars]
# APP_BASE_URL=https://taakhelden-web.oostelaar.workers.dev
# APNS_ENV=sandbox
```

List names only (never prints values):

```bash
npx wrangler secret list
```

### Known non-goals (this audit)

- `[env.production]` in `wrangler.toml` still has no separate D1/R2/KV IDs;
  CI deploys the **default** worker name `taakhelden-api` (not `taakhelden-api-prod`).
- Custom domains (`api.taakhelden.nl` / dashboard) not configured yet;
  smoke tests use `*.oostelaar.workers.dev`.
- Web Worker has no secrets by design (BFF only).

---

## Topology (post-#72)

```
Browser ──same-origin──► taakhelden-web
                            │
                            ├─ env.API (service binding) ──► taakhelden-api /v1/*
                            └─ API_BASE_URL (var) ──► browser WS URL only
                                                         │
taakhelden-api ── DB / PHOTOS / KV / FAMILY_DO / queues / crons
```
