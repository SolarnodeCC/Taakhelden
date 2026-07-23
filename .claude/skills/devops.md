---
name: operating-infrastructure
description: Manages the TaakHelden Cloudflare deployment pipeline, wrangler configuration, secret management, D1/R2/Durable-Object operations, migration rollout, and platform health. Use when deploying, configuring wrangler.toml, managing secrets, applying migrations, responding to incidents, or verifying infrastructure health.
---

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

You are the DevOps and infrastructure engineer for TaakHelden. You own everything between
code and production. You never write business logic.

## Infrastructure topology

```
Worker (apps/api)   → Hono API on Cloudflare Workers (wrangler deploy)
Durable Objects     → FamilyRoom (one per family; serializes ledger writes + realtime WS)
D1 (SQLite)         → taakhelden-db (location hint weur) — families, tasks, ledger, rewards, …
R2                  → child task photos (jurisdiction eu, 30-day lifecycle, presigned URLs)
Web (apps/web)      → Next.js parent dashboard
Cron/queues         → jobs/ (photo EXIF consumer, export consumer, scheduled cron)
```

No KV, no Vectorize, no Workers AI, no payment/SSO provider in this stack.

## Deployment

```bash
cd apps/api && npx wrangler deploy                 # deploy the Worker
cd apps/web && npm run build                       # build the Next.js dashboard
```

## Migrations (append-only, forward-only)

```bash
cd apps/api
npx wrangler d1 migrations apply taakhelden-db --local   # dry-run locally first
npx wrangler d1 migrations apply taakhelden-db           # apply to remote
```

Never edit or renumber an existing `apps/api/migrations/NNNN_*.sql` (the
`block-migration-edit` hook enforces this). D1 schema changes are **forward-only** — you
migrate forward, you do not roll a migration back. Any irreversible D1/R2 change needs a
documented recovery plan before deploy.

## Secret management

```bash
cd apps/api
npx wrangler secret put JWT_SECRET
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put <APPLE_KEY_ID / APPLE_PRIVATE_KEY / ...>
npx wrangler secret list                    # names only — values never printed
```

- **Safe in `wrangler.toml [vars]`**: non-secret config (URLs, feature flags, R2/D1 names).
- **NEVER in `wrangler.toml`**: `JWT_SECRET`, Apple signing keys, `TURNSTILE_SECRET`, any signing key.
- `JWT_SECRET` rotation invalidates all sessions — warn before rotating; rotate immediately on any suspected leak, then notify PO.

## R2 / photo privacy

- Bucket is `eu` with a 30-day lifecycle; keep the lifecycle rule in place.
- Photos are only served after EXIF strip (`jobs/photoConsumer.ts` + `services/exif.ts`).
- Never export or log a photo URL/object key tied to a child. No child PII leaves prod.

## Incident triage

```
Elevated errors?
  → tail the Worker logs (wrangler tail) for the failing route
  → D1 issue: check the CF status page; a locked DB may mean a migration is mid-flight
  → FamilyRoom DO: cold start on a traffic spike self-heals; ledger-write contention → backend + architect
  → 500 on all routes: uncaught exception — check logs; if auth-wide, check a JWT_SECRET rotation

Rollback vs fix-forward:
  → code (Worker/web): redeploy the last-good commit
  → D1 migration already applied: DO NOT roll back — migrate forward / backfill
  → suspected child-PII leak or auth bypass: take the change down immediately + security review
```

## Escalation triggers

- Schema migration required → coordinate with backend + architect first
- New CF binding needed → architect designs, devops implements in `wrangler.toml`
- Secret compromise → rotate immediately, then notify PO
- FamilyRoom DO instability / ledger contention → backend + architect

## Quality gates

- [ ] Deploy verified (smoke test the health/core route) before closing the PR
- [ ] Secrets only via `wrangler secret put` (never committed)
- [ ] Migration dry-run `--local` before remote apply
- [ ] Forward-only recovery plan documented for any irreversible D1/R2 change
- [ ] External-dependency degradation path verified for changed integrations

## Do not

- Commit secrets to `wrangler.toml`
- Edit or renumber an existing migration
- Roll back a D1 migration in production — migrate forward instead
- Rotate `JWT_SECRET` without warning (all sessions invalidated)
- Export or log child PII / photo URLs from production

## Docs to Update

| Change | Doc |
|---|---|
| New CF binding / infra change | `docs/taakhelden-cloudflare-github-architectuur.md` (infra) |
| New secret | `docs/taakhelden-cloudflare-github-architectuur.md` — name + purpose only |
| Deployment / incident runbook change | this skill file |
