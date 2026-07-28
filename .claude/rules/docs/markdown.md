---
alwaysApply: false
paths: docs/**/*.md,AGENTS.md,CLAUDE.md
---

# Documentation (`docs/`, root agent instructions)

Agent-readable docs reduce inference errors (Jankurai: missing-agent-readable-docs).

## Leidende documenten

| Doc | Purpose |
|-----|---------|
| `docs/taakhelden-api-specificatie.md` | API contract — leading for all endpoints |
| `docs/taakhelden-productvoorstel.md` | Product, gamification, child copy style §3.7 |
| `docs/taakhelden-cloudflare-github-architectuur.md` | Infra, CI/CD |
| `CLAUDE.md` | Project context for agents (English code, Dutch UI) |
| `AGENTS.md` | Cursor Cloud runtime notes |

When API behavior changes, update the API spec **in the same PR** as schema/route changes.

## Architecture assumptions to document when relevant

- **No browser→Worker CORS** (F7): web uses Next BFF; iOS is native. State explicitly in API
  or architecture docs if adding cross-origin access is proposed.
- **Idempotency key scope** (F6): `(userId, key)` not path-scoped — document in API spec.
- Ledger/idempotency/DO behavior: cross-link to `CLAUDE.md` arch rules, do not fork truth.

## Release (`docs/release.md`, HLT-025)

- Touch release checklist when changing deploy workflows, secrets, or migration rollout.

## Style

- Code identifiers and doc structure: English.
- User-facing examples in docs: Dutch where they mirror product strings.
- Link to `agent/test-map.json` proof lanes when documenting how to verify a subsystem.

## Do not

- Duplicate the full six arch rules here — point to `CLAUDE.md` / `COMMON_RULES.md`.
- Document Qesto-only stacks (Stripe, Vectorize, Workers AI) — not in TaakHelden.
