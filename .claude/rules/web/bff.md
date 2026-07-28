---
alwaysApply: false
paths: apps/web/app/api/**/*.ts,apps/web/lib/api/**/*.ts,apps/web/lib/auth/**/*.ts
---

# Web BFF and API client (`apps/web/app/api/`, `lib/api/`, `lib/auth/`)

The Next.js app is a **BFF proxy** — the browser never calls the Worker directly.
Jankurai HLT-006 flags the proxy route as "wrong layer"; here that is **intentional**.

## BFF only — no D1/SQL

- `app/api/v1/[...path]/route.ts` forwards via `apiFetch()` — no database access from web.
- No D1/R2/DO bindings on the web Worker. The only cross-Worker binding is
  service binding `API` → `taakhelden-api` (see `wrangler.jsonc`).

## Secrets and URLs

- `API_BASE_URL` is **server-only** — never `NEXT_PUBLIC_API_*`.
  Read it via `getApiBaseUrl()` / call the Worker via `apiFetch()`
  (`lib/api/config.ts`). On Cloudflare, `apiFetch` **must** use the `API`
  service binding — global `fetch()` between Workers on the same
  `*.workers.dev` zone fails (BFF 502). Do not fall back to global fetch for
  `*.workers.dev` URLs.
- Session tokens in `httpOnly` cookies (`lib/api/cookies.ts`): `secure` in production,
  `sameSite=lax`.
- Proxy responses: `Cache-Control: no-store` for authenticated routes.

## Client usage

- Browser code calls `/api/v1/*` and `/api/auth/*` on the same origin — not `localhost:8787`.
- Use `lib/api/client.ts` patterns; do not scatter fetch URLs.

## Auth routes

- Register/login/logout/accept-parent: set/clear cookies server-side.
- Do not expose refresh tokens to `document.cookie` or client JS.

## CORS (F7)

- Do not add CORS headers to make the Worker callable from the browser — architecture
  assumes same-origin BFF. Document in API docs if questioned.

## Verification

```bash
rg -n 'NEXT_PUBLIC' apps/web/lib/api apps/web/app/api
rg -n '\.prepare\(|D1Database' apps/web/
```

Both should return nothing.
