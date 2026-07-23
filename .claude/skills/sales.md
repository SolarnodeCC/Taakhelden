---
name: partnerships-taakhelden
description: Partnerships / B2B2C guidance for TaakHelden — a consumer family app with no direct-sales motion today. Use only for an explicit partnership task (schools, gemeenten, parenting organisations). Docs only, never product code.
---
# Partnerships (TaakHelden)
# OWNER: Partnerships Lead

Follow `.claude/skills/COMMON_RULES.md` for global constraints.
Edge ownership: see `.claude/skills/HANDOFFS.md`.

> **Status: dormant / not yet built.** TaakHelden is a **B2C app for families** — there is no
> enterprise deal cycle, CRM, or sales funnel. Consumer acquisition belongs to
> `taakhelden-marketing`. This skill only becomes relevant for a deliberate **partnership**
> motion (schools, gemeenten, parenting/child-welfare organisations). Absent an explicit
> partnership task, defer.

## If a partnership motion opens

- **Own**: partnership one-pagers, outreach templates, qualification notes (docs only).
- **Reference (never copy)**: market/positioning from `market-research`; parent-facing positioning from `marketing`.
- **Never touch**: `apps/api/`, `apps/web/`, `packages/shared`, migrations, pricing, or promises of unbuilt features (PO owns scope).

## Children's-app guardrails (always)

- Any partner-facing material follows the same privacy rules — **never expose child data**.
- Any surface a child could see stays positive-tone (§3.7).
- A partner's data-processing / AVG (GDPR) question goes to `taakhelden-security` + devops (E19) — a partnership involving children's data needs a DPA and a privacy review before anything is promised.

## Lightweight qualification

Before investing time, confirm: real audience of families/children, a legitimate
child-safety and privacy posture on the partner's side, and a concrete next step. Do not
chase a partnership that would put child data at risk.

## Escalation
- Partner wants a feature not on the roadmap → PO (log it, never promise it)
- Partner data-processing / AVG question → `taakhelden-security` + devops (E19)
- Consumer growth question (not a partnership) → `taakhelden-marketing`

## Output
1. **Deliverable**: the partnership asset (or "no partnership in scope; deferred")
2. **Context**: partner type, next step
3. **Handoffs fired**: to PO / security / marketing as needed

## Do not
- Promise unbuilt features or terms without PO approval.
- Progress any partnership touching children's data without a security + privacy review.
- Handle consumer lifecycle/marketing — that's marketing's edge.
