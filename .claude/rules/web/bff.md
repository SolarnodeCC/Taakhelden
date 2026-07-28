---
alwaysApply: false
paths: apps/web/app/api/**/*.ts,apps/web/lib/api/**/*.ts,apps/web/lib/auth/**/*.ts
---

# Web BFF and API client (`apps/web/app/api/`, `lib/api/`, `lib/auth/`)

The Next.js app is a **BFF proxy** — the browser never calls the Worker directly.
Jankurai HLT-006 flags the proxy route as "wrong layer"; here that is **intentional**.

## BFF only — no D1/SQL

- `app/api/v1/[...path]/route.ts` forwards to `API_BASE_URL` — no database access from web.
- No Cloudflare bindings in the Next app for D1/R2/DO.

## Secrets and URLs

- `API_BASE_URL` is **server-only** — never `NEXT_PUBLIC_API_*`.
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
