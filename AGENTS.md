# AGENTS.md

Project context, architecture rules, stack, and standard commands live in `CLAUDE.md`
and `docs/`. Read those first. This file only adds environment/runtime notes.

## Cursor Cloud specific instructions

Standard commands (`dev:api`, `dev:web`, `test`, `typecheck`, migrations) are documented
in `CLAUDE.md` — use those. Notes below are the non-obvious bits for running locally.

### Services
- **API** (`apps/api`) — Cloudflare Worker via `wrangler dev`, serves `http://localhost:8787`
  (base path `/v1`). D1/R2/KV/Durable Object/Queues are all emulated locally by Miniflare;
  no real Cloudflare account is needed for dev/testing.
- **Web** (`apps/web`) — Next.js parent dashboard via `next dev` on `http://localhost:3000`.
  It is a BFF proxy: the browser only calls the web app, which forwards `/api/v1/*` to the
  API. `API_BASE_URL` defaults to `http://localhost:8787/v1`, so **start the API first**.
- **iOS** (`apps/ios`) — README only, no Xcode project yet; not runnable here.

### Running the API locally (gotchas)
- Auth flows need a `JWT_SECRET`. Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars`
  (gitignored). Without it the Worker still boots and `/v1/health` returns
  `{ ok: true }`, but register/login and any authed endpoint fail.
- Apply local D1 migrations before first use: `npm run db:migrate:local -w apps/api`
  (writes to `apps/api/.wrangler/state`). Re-run after adding a migration.
- Turnstile, email invites, APNs push, and Sign in with Apple are env-guarded no-ops when
  their secrets are unset — email/password auth works without any of them locally.
- Miniflare does not auto-fire cron triggers; use `wrangler dev --test-scheduled` to test them.

### Lint / test / build
- `npm run lint` runs ESLint across all TypeScript/React source with zero warnings allowed.
- `npm test` runs both the API suite via `@cloudflare/vitest-pool-workers` (real Workers
  runtime) and the web contract tests.
