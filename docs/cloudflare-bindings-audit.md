# Cloudflare bindings & secrets audit

_Audit date: 2026-07-28. Last live verification: 2026-07-29. Baseline: post-#72 (`taakhelden-web` → `API` service binding)._

Live secret **values** are never recorded here. Secret **names** only.
Account ID (non-secret): `5546763229b35df670e33d9316d7f2e0`.

---

## Implementation status

| Item | Where configured | Status |
|---|---|---|
| Web `API` service binding | [`apps/web/wrangler.jsonc`](../apps/web/wrangler.jsonc) | Implemented |
| Web `ASSETS` | wrangler.jsonc | Implemented |
| Web `API_BASE_URL` var | wrangler.jsonc | Implemented |
| API D1 / R2 / KV / DO / queues / crons | [`apps/api/wrangler.toml`](../apps/api/wrangler.toml) | Implemented |
| API vars `APP_BASE_URL`, `APNS_ENV`, `APPLE_CLIENT_ID`, `APPLE_BUNDLE_ID` | wrangler.toml `[vars]` | Implemented |
| API required secret `JWT_SECRET` | wrangler.toml `[secrets].required` + deploy sync | **Declared**; must exist in GitHub Environment `production` |
| Optional secrets (Turnstile / APNs key / email) | deploy-prod sync when set in GitHub | Implemented (upload-if-present) |
| Optional secrets (Turnstile / APNs key / email) | deploy-prod sync when set in GitHub | Implemented (upload-if-present) |

---

| Type | Name | Value / target |
|---|---|---|
| Service binding | `API` | Worker `taakhelden-api` |
| Assets | `ASSETS` | `.open-next/assets` |
| Var | `API_BASE_URL` | `https://taakhelden-api.oostelaar.workers.dev/v1` |
| Secrets | — | none |

BFF uses `env.API.fetch()` ([`apps/web/lib/api/config.ts`](../apps/web/lib/api/config.ts)). Global `fetch` to `*.workers.dev` without the binding is rejected.

---

## `taakhelden-api`

### Bindings

| Type | Name | Resource |
|---|---|---|
| D1 | `DB` | `taakhelden-db` |
| R2 | `PHOTOS` | `taakhelden-photos` (jurisdiction `eu`) |
| KV | `KV` | namespace id in wrangler.toml |
| Durable Object | `FAMILY_DO` | class `FamilyRoom` |
| Queue | `PHOTO_QUEUE` / `EXPORT_QUEUE` | `photo-processing` / `export-processing` |
| Cron | — | `5 0 * * *`, `*/15 * * * *` |

### Vars (in git via `[vars]`)

| Name | Default |
|---|---|
| `APP_BASE_URL` | `https://taakhelden-web.oostelaar.workers.dev` |
| `APNS_ENV` | `sandbox` |
| `APPLE_CLIENT_ID` | `com.taakhelden.web` |
| `APPLE_BUNDLE_ID` | `nl.taakhelden.app` |

### Secrets

| Name | Required | Source |
|---|---|---|
| `JWT_SECRET` | **yes** (`[secrets].required`) | GitHub Environment `production` → synced by `deploy-prod.yml` |
| `HMAC_SECRET` | no (falls back to `JWT_SECRET`) | Dedicated key for photo/export signed URLs — **recommended in production** |
| `TURNSTILE_SECRET` | **yes** (`[secrets].required`) | GitHub Environment `production` → synced by `deploy-prod.yml`. Registration fails closed without it; the deploy job errors out when it is unset. |
| `APNS_KEY` | no | GitHub → sync if set |
| `APNS_KEY_ID` | no | GitHub → sync if set |
| `APNS_TEAM_ID` | no | GitHub → sync if set |
| `EMAIL_API_KEY` | no | GitHub → sync if set |
| `EMAIL_FROM` | no | GitHub → sync if set |

---

## Operator checklist (before / after merge)

1. In GitHub → **Settings → Environments → production → Secrets**, set at least:
   - `CLOUDFLARE_API_TOKEN` (already used by deploy)
   - **`JWT_SECRET`** — long random value (`openssl rand -base64 48`)
   - **`TURNSTILE_SECRET`** — from the Turnstile widget for `wispel.cc`
2. Optionally set: `HMAC_SECRET` (recommended — photo/export URL signing; falls back to `JWT_SECRET`), `APNS_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `EMAIL_API_KEY`, `EMAIL_FROM`.
3. On the next `deploy-prod` run, the **Sync Worker secrets** step uploads them, then `wrangler deploy` validates `JWT_SECRET` and `TURNSTILE_SECRET` are present.
4. Smoke: `GET /v1/health` → `{ ok: true, db: true }`; `POST /v1/auth/register` with an invalid Turnstile token must return **400** (a 201 would mean bot protection is off).

> Local development skips the Turnstile call with `TURNSTILE_DEV_BYPASS="true"` in `.dev.vars`.
> Never set that variable on a deployed Worker — it disables the check outright.

One-shot local put (if you prefer not to wait for CI):

```bash
cd apps/api
openssl rand -base64 48 | npx wrangler secret put JWT_SECRET
npx wrangler secret list   # names only
```

---

## Topology (post-#72)

```
Browser ──same-origin──► taakhelden-web
                            │
                            ├─ env.API (service binding) ──► taakhelden-api /v1/*
                            └─ API_BASE_URL (var) ──► browser WS URL only
                                                         │
taakhelden-api ── DB / PHOTOS / KV / FAMILY_DO / queues / crons
                 + [vars] APP_BASE_URL, APNS_*, APPLE_*
                 + secrets JWT_SECRET (+ optional Turnstile/APNs/email)
```
