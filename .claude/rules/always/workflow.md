# Workflow — proof lanes and PR gates

Follow `.claude/skills/COMMON_RULES.md` for the six hard architecture rules. This file
adds **workflow and proof routing** (Jankurai: proof lanes, one-command validation).

## Before every PR

```bash
npm run typecheck
npm test
```

Run `/arch-check` (`@architecture-reviewer`) when API, shared contracts, or architecture
boundaries change.

## Proof lanes (`agent/test-map.json`)

| Path prefix | Command |
|-------------|---------|
| `apps/api/` | `npm test` |
| `apps/api/migrations/` | `npm run db:migrate:local -w apps/api` |
| `apps/web/` | `npm run typecheck --workspaces --if-present` |
| `packages/shared/` | `npm run typecheck --workspaces --if-present` |
| `.` (root) | `npm run typecheck && npm test` |

When you change a path, run its proof lane before claiming green.

## Ownership (`agent/owner-map.json`)

Check owner before editing outside your task scope. `.claude/` and `agent/` → cell
`agent`. Do not add `ops/ci/*.sh` only to satisfy audit heuristics — this monorepo
uses npm scripts and `.github/workflows/`.

## Standard change patterns

- **New API route** → Zod schema in `packages/shared` + authz test in `apps/api/test/`
  (see skill `endpoint-scaffold`).
- **Schema change** → `packages/shared` first, then API + web consumers.
- **D1 migration** → new numbered `apps/api/migrations/NNNN_*.sql` only (`/new-migration`).
  Never edit existing migrations (hook `block-migration-edit.mjs` blocks it).
- **UI change** → design tokens + primitives; `/design-check` for user-facing diffs.

## Generated zones — do not hand-edit

- `target/jankurai/repo-score.json`, `score-history.jsonl`, SARIF, repair queues.
- Refresh baseline only via `agent/baselines/README.md`.

Exception: `target/jankurai/taakhelden-code-review.md` is a hand-written review doc.

## Evidence

Paste real command output. Cite `file:line` for code claims. Verify paths with Glob/Grep
before naming them.
