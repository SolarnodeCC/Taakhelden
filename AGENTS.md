# AGENTS.md

Project context, architecture rules, stack, and standard commands live in `CLAUDE.md`
and `docs/`. Read those first. This file only adds environment/runtime notes.

**Wispel canon (read before product/pricing/privacy work):**
- `docs/wispel-build-plan-workstreams.md` — workstreams + open points §13
- `docs/wispel-rebrand-and-ui-plan.md` — rebrand strategy
- `docs/adr/ADR-0005-wispel-privacy-free-donations.md` — privacy first, free + donations

Product name is **Wispel** (`wispel.cc`). Child vocabulary is **Ster / Star** (never Held/Hero).
Do **not** implement freemium, trial paywalls, or child-facing donation UI. Code paths may
still say `taakhelden` until rename workstreams.

## Cursor Cloud specific instructions

Standard commands (`dev:api`, `dev:web`, `test`, `typecheck`, migrations) are documented
in `CLAUDE.md` — use those. Notes below are the non-obvious bits for running locally.

### Cloud agent environment baseline
- This monorepo expects **Node 22+** and a successful root-level `npm ci` before any
  workspace scripts are used.
- A healthy cloud-agent startup has these tools available out of the box:
  `tsc`, `vitest`, `npm run typecheck`, and `npm test`.
- If a fresh cloud runner is missing those binaries, the environment snapshot is
  incomplete; run `npm ci` from the repo root or refresh the shared cloud-agent
  environment via Cursor Web.

### Services
- **API** (`apps/api`) — Cloudflare Worker via `wrangler dev`, serves `http://localhost:8787`
  (base path `/v1`). D1/R2/KV/Durable Object/Queues are all emulated locally by Miniflare;
  no real Cloudflare account is needed for dev/testing.
- **Web** (`apps/web`) — Next.js parent dashboard via `next dev` on `http://localhost:3000`.
  It is a BFF proxy: the browser only calls the web app, which forwards `/api/v1/*` to the
  API via `apiFetch()` (local: `API_BASE_URL` → `http://localhost:8787/v1`; on Cloudflare:
  service binding `API` → `taakhelden-api` — see `docs/cloudflare-bindings-audit.md`).
  **Start the API first** for local web.
- **iOS** (`apps/ios`) — README only, no Xcode project yet; not runnable here.

### Running the API locally (gotchas)
- Auth flows need a `JWT_SECRET`. Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars`
  (gitignored). Without it the Worker still boots, but `/v1/health` returns 503 and
  register/login / any authed endpoint fail. Optional `HMAC_SECRET` is used for
  photo/export signed URLs (falls back to `JWT_SECRET` when unset).
- Apply local D1 migrations before first use: `npm run db:migrate:local -w apps/api`
  (writes to `apps/api/.wrangler/state`). Re-run after adding a migration.
- Turnstile, email invites, APNs push, and Sign in with Apple are env-guarded no-ops when
  their secrets are unset — email/password auth works without any of them locally.
- Miniflare does not auto-fire cron triggers; use `wrangler dev --test-scheduled` to test them.

### Lint / test / build
- `npm run lint` runs ESLint across all TypeScript/React source with zero warnings allowed.
- `npm test` runs both the API suite via `@cloudflare/vitest-pool-workers` (real Workers
  runtime) and the web contract tests.
