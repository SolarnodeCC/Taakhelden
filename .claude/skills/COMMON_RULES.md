---
name: common-rules
description: Global constraints every TaakHelden agent and skill must follow — the six hard architecture rules, language/tone rules, edge-runtime constraints, and privacy. Referenced at the top of every agent. Read this before acting in any role.
---
# COMMON_RULES — global constraints for every TaakHelden role

Every agent opens with "Follow `.claude/skills/COMMON_RULES.md`". This is that file. These
rules are non-negotiable and override role-specific convenience. They restate `CLAUDE.md`
for agent use — if the two ever diverge, `CLAUDE.md` wins.

## The six hard architecture rules

1. **Routes never talk to D1 directly.** All SQL lives in `apps/api/src/repo/`. Every repo
   function takes `familyId` as the first argument (after the DB handle) and every query
   filters `family_id = ?`. This is the security boundary — D1 has no row-level security.
2. **All mutation endpoints are idempotent** via the `Idempotency-Key` header. Ticking a
   task off twice must never grant points twice.
3. **Point balance = the sum of the ledger** (`points_ledger`), never a stored balance
   field. Ledger writes run through the `FamilyRoom` Durable Object.
4. **No negative mechanics.** Points are only ever deducted when redeeming a reward
   (redemption) or cancelling one. No penalties, no "straf"-logic, no negative points.
5. **Privacy.** No child e-mail/PII. Photos are EXIF-stripped before they become visible.
   Never log names or photo URLs.
6. **Validate requests/responses with the Zod schemas in `packages/shared`.** New fields go
   into the schema first.

## Language & tone

- Code, identifiers, commit messages, PR text: **English**.
- User-facing strings: **Dutch**.
- Notification and error text for children: **always positive** (style guide in the
  productvoorstel, §3.7). Never guilt/pressure language. When in doubt about child-facing
  copy, route it through `@dutch-child-copy`.

## Edge-runtime constraints (API)

- Cloudflare Workers runtime — **no Node.js APIs**: no `fs`, no `Buffer` (use `Uint8Array`),
  no `process.env` (use `c.env`).
- Persistent state lives in **D1** (`taakhelden-db`, `weur`) and **R2** (photos, `eu`,
  30-day lifecycle). No KV, no Vectorize, no Workers AI, no third-party payment/SSO in this
  stack.
- Migrations are **append-only**: add a new numbered `apps/api/migrations/NNNN_*.sql`;
  never edit or renumber an existing one (the `block-migration-edit` hook enforces this).

## Workflow guardrails

- New route ⇒ Zod schema in `packages/shared` **and** an authz test in `apps/api/test/`.
- Before opening a PR: `npm run typecheck` + `npm test` green, and `/arch-check`
  (`@architecture-reviewer`) clean.
- Report results honestly — paste real command output; never claim a test passed you
  didn't run.

## Evidence & anti-hallucination

- Cite `file:line` for any claim about the code; verify a path with Glob/Grep before naming
  it. Don't invent files, functions, endpoints, or numbers.
- Judge only what's in scope (the diff/task); don't speculate about unchanged code unless
  the change touches it.

## The team (who owns what)

Design → `@taakhelden-architect`. API/D1/DO → `@taakhelden-backend`. Web dashboard →
`@taakhelden-web`. iOS → `@taakhelden-ios`. Infra/deploy → `@taakhelden-devops`. Unit/integration
tests → `@taakhelden-tester`; E2E/load/a11y → `@taakhelden-e2e`. Security/privacy →
`@taakhelden-security`. Localization → `@taakhelden-i18n`. Docs → `@taakhelden-knowledge`.
Metrics → `@taakhelden-analytics`. Product → `@taakhelden-product-owner`. Child copy →
`@dutch-child-copy`. Architecture review → `@architecture-reviewer`. Migrations →
`@migration-writer`. Growth/AI roles (`marketing`, `sales`, `seo-reviewer`,
`market-research`, `ai-engineer`, `ai-strategy`) are advisory / not-yet-built — see each
agent. Handoff edges: `.claude/skills/HANDOFFS.md`.
