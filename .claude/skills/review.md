---
name: reviewing-code
description: Runs pre-merge code-quality gates for TaakHelden covering correctness, the six hard architecture rules, security/child-privacy, and accessibility. Use before every merge or after story implementation to block on critical findings.
---
# Skill: Code Review (TaakHelden)
# SCOPE: pre-merge quality gate — correctness / hard-rules / security / a11y
# LOAD: before every merge, after story implementation
# OWNER: QA + Security (shared gate)

## Role
Code quality gate for TaakHelden. You review changed files against automated and manual
gates, block merges on critical findings, and escalate security/architecture issues. The
deep six-rule pass is `@architecture-reviewer` (`/arch-check`) — run it as part of this gate.

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

## Step 1 — Automated gates (block on failure)

```bash
npm run typecheck
npm test
npm run lint        # if present
```

## Step 2 — The six hard rules (run /arch-check)

```
□ No SQL in routes — all SQL in apps/api/src/repo/ (no .prepare( / .batch( in routes/)
□ familyId is the first repo arg; every query filters family_id = ?; familyId never from the body
□ Every mutation is idempotent (Idempotency-Key)
□ Points = SUM(points_ledger) via the FamilyRoom DO; no balance column written
□ No negative mechanics (points only decrease on redemption / its cancellation)
□ Child privacy: no PII stored/logged, photos EXIF-stripped before visible, no photo URLs in logs
□ Requests/responses validated by packages/shared Zod schemas
□ Schema change is a NEW numbered migration (never an edit)
```

## Step 3 — Correctness

```
□ No console.log left in production paths
□ No hardcoded user-facing strings — Dutch via next-intl; child-facing tone via @dutch-child-copy
□ Every fetch/DB call has error handling → visible UI error (in NL)
□ Async buttons have disabled/loading state
□ Malformed input → 400/422, never 500; 500s sanitized (no stack/SQL/PII)
□ Error responses use ErrorCodes from packages/shared/src/errors.ts
```

## Step 4 — Web / accessibility (apps/web)

```
□ DTOs imported from packages/shared (no duplicated backend types)
□ Shared fetch/SWR helpers reused (no copy-pasted loading/error hook)
□ Buttons ≥ 44px; icon-only buttons have aria-label; focus-visible ring
□ Loading + error states (in NL) for all async data
□ Contrast ≥ 4.5:1 for text; tested at mobile viewport
```

## Step 5 — Security / privacy (quick)

```
□ No secrets in code or wrangler.toml
□ Auth applied; familyId from token; role gating (requireParent) where needed
□ No user input in a fetch() URL without an allowlist (SSRF)
□ Auth/rate-limit failures logged with trace context (no PII), not swallowed
□ FamilyRoom/WS handler exceptions contained and safe for clients
```

## Risk-tiered depth

- **Tier 1 (high risk)** — auth, ledger/points, FamilyRoom DO, migrations, photo/PII: run all
  steps + `@architecture-reviewer` + `@taakhelden-security`.
- **Tier 2 (medium)** — non-auth API routes, web flows: steps 1–4.
- **Tier 3 (low)** — pure UI, docs, no-behavior refactors: step 1 + correctness spot-check.

## Severity

| Level | Examples | Action |
|---|---|---|
| **Block** | Tests fail, TS error, cross-family access, missing EXIF strip, double-award | Merge forbidden |
| **Require** | Missing aria-label, missing error state, missing authz test | Fix before merge |
| **Suggest** | Naming, minor refactor | Optional |

## Output contract
✅ passed gates · 🔴 blocking · 🟡 required · 💡 suggestions · decision: APPROVED / BLOCKED / APPROVED WITH CHANGES.

## Do not
- Approve if tests fail or types error.
- Approve Tier 1 changes without security + architecture review.
- Skip accessibility checks on UI changes, or the child-privacy checks on any data/photo change.
