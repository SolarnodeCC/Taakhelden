---
name: handoffs
description: The handoff-edge map between TaakHelden agents — who hands what to whom, keyed by the E-numbers the agents cite. Read when an agent needs to escalate or pass work to another role.
---
# HANDOFFS — the edge map between TaakHelden roles

Agents cite edges by number (e.g. "→ backend (E28)"). This file defines them for
TaakHelden. An edge is a directed handoff: **producer → consumer : what crosses**. Fire an
edge explicitly in your output ("Handoff → backend: new field in packages/shared, E5") so
the receiving role knows to pick it up.

## Product & research

- **E1** — market-research → product-owner: research context / market pulse for backlog grooming.
- **E15** — market-research ⇄ marketing: ICP + competitor source-of-truth (marketing *references*, never copies).

## Design & implementation

- **E4** — backend / tester → architect: a change that needs a design decision — new
  migration shape, FamilyRoom/ledger protocol change, or cross-layer impact.
- **E5** — backend → web: a new/changed API contract, published as a Zod schema in
  `packages/shared` (path, method, request/response shape).
- **E6** — backend → iOS: the same contract, consumed by the SwiftUI client. `packages/shared`
  is the single BE↔client boundary; clients are read-only consumers of it.
- **E13** — backend → analytics + architect: a new analytics/observability event type.

## QA gates

- **E8** — tester / e2e → producing dev: a diff fails a quality gate; returned with the failure.
- **E9** — tester / e2e → devops: gate result relevant to release readiness.
- **E23** — tester / e2e → architect: a reproducible FamilyRoom / WebSocket defect (via the
  `investigate.md` skill) that needs a design fix.
- **E31** — e2e → web + product-owner: a WCAG/a11y violation found in an audit.
- **E32** — e2e → devops + architect: a load/latency threshold exceeded.

## Knowledge

- **E24** — every role → knowledge: their "Docs to Update" landings, for placement / accuracy / no-contradiction verification.
- **E25** — product-owner → knowledge: a new/changed business requirement to capture with a reference.
- **E26** — knowledge → all: the doc map (`docs/taakhelden-*` + `CLAUDE.md`) as the research entry point.

## AI (dormant / not-yet-built — see the AI agents)

- **E27** — ai-strategy → ai-engineer: an approved AI scope + required guardrails.
- **E28** — ai-engineer → backend: the route/binding/DB plumbing around an AI feature.
- **E30** — ai-engineer → security: any AI output that could reach a child, or a PII risk.

## Growth (advisory / not-yet-built — see the growth agents)

- **E16** — marketing → sales: a partnership-ready lead (only if a partnership motion is open).
- **E17** — sales → product-owner / market-research: partner-surfaced product gaps (logged, never promised).
- **E19** — sales → security + devops: a partner data-processing / AVG question.
- **E33** — seo-reviewer → marketing: copy / content / search-intent fixes.
- **E34** — seo-reviewer → web: technical markup / meta / SSR / render fixes.

## Always-on reviewers (not numbered)

- Any dev → `@architecture-reviewer` (`/arch-check`): the six-hard-rules gate before a PR.
- Any dev → `@dutch-child-copy`: positive-tone review of child-facing strings.
- Any schema change → `@migration-writer`: create the new numbered D1 migration.
