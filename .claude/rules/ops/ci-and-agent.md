---
alwaysApply: false
paths: .github/workflows/**/*.yml,.github/workflows/**/*.yaml,.claude/**/*,agent/**/*
---

# CI, agent config, and governance (`agent/`, `.claude/`, `.github/workflows/`)

## GitHub Actions (HLT-034, HLT-042)

- Pin **every** third-party action to a full 40-character commit SHA (not floating `@v1`).
- Security-related jobs must not use `continue-on-error` for scan failures.
- After workflow edits, run local parity at minimum: `npm run typecheck && npm test`.
- Do not remove `.github/workflows/jankurai.yml` — it is the Jankurai ratchet lane.

## Monorepo CI layout (conscious choice)

- This repo uses **npm scripts** + `.github/workflows/ci.yml`, not `ops/ci/*.sh`.
- Do not add fake `ops/ci/` or `scripts/ci-local.sh` only to satisfy Jankurai reference
  profiles without team agreement.

## `.claude/` changes (agent-tool supply chain)

- Hooks must remain active in `settings.json`:
  - `block-migration-edit.mjs` (PreToolUse)
  - `guard-route-sql.mjs` (PostToolUse)
- New agents/skills: follow existing frontmatter patterns; reference `COMMON_RULES.md`.
- Path rules live in `.claude/rules/` — see `README.md` for glob index.

## `agent/` governance files

- `owner-map.json` — path ownership; update when adding major directories.
- `test-map.json` — proof lane per path prefix; update when proof commands change.
- `audit-policy.toml` — Jankurai scan policy; `Design System/` excluded from product scans.
- `baselines/main.repo-score.json` — ratchet baseline; refresh via `agent/baselines/README.md`
  only, not ad-hoc edits.

## Jankurai security lane

- CI may run `jankurai security run` before audit — do not weaken without `@taakhelden-devops`
  review.
