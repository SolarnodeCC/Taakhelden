# TaakHelden — path-scoped Claude rules

Rules in `.claude/rules/` load **on demand** when Claude reads or edits files matching
the `paths` glob (lazy: `alwaysApply: false`). Global workflow rules live in
`always/workflow.md` and load every session.

| Path | Rule file | Glob |
|------|-----------|------|
| Always | `always/workflow.md` | (no `paths` — always loaded) |
| API routes | `api/routes.md` | `apps/api/src/routes/**/*.ts` |
| API repo | `api/repo.md` | `apps/api/src/repo/**/*.ts` |
| API services/DO/jobs | `api/services-and-do.md` | `services/**`, `do/**`, `jobs/**` |
| API middleware | `api/middleware.md` | `apps/api/src/middleware/**/*.ts` |
| D1 migrations | `api/migrations.md` | `apps/api/migrations/**/*.sql` |
| API tests | `api/tests.md` | `apps/api/test/**/*.ts` |
| Shared contracts | `shared/schemas.md` | `packages/shared/**/*.ts` |
| Web UI | `web/ui.md` | `apps/web/**/*.tsx`, `**/*.css`, `tailwind.config.ts` |
| Web BFF | `web/bff.md` | `app/api/**`, `lib/api/**`, `lib/auth/**` |
| Web i18n | `web/i18n.md` | `messages/**`, `i18n/**` |
| iOS | `ios/swift.md` | `apps/ios/**/*.swift`, `**/*.strings` |
| Android | `android/kotlin.md` | `apps/android/**/*.kt`, `**/*.kts`, `**/*.xml` |
| CI & agent | `ops/ci-and-agent.md` | `.github/workflows/**`, `.claude/**`, `agent/**` |
| Generated zones | `ops/generated-zones.md` | `target/jankurai/**`, baseline JSON |
| Docs | `docs/markdown.md` | `docs/**`, `AGENTS.md`, `CLAUDE.md` |

Ownership: `agent/owner-map.json` (cell `agent` owns `.claude/`). Proof lanes:
`agent/test-map.json`. Design rationale and Jankurai mapping: `PROPOSAL.md`.

Skills complement rules (templates/playbooks): `endpoint-scaffold`, `design-system`.
Hooks enforce mechanically: `block-migration-edit.mjs`, `guard-route-sql.mjs`.
