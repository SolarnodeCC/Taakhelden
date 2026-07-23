---
name: engineering-ai
description: AI/GenAI implementation craft for TaakHelden on Workers AI — prompt design, output validation, evals, safety guardrails, and latency/cost budgets. Use only when an AI feature is actually being built. Workers AI only; never over child PII.
---
# Skill: AI Engineering (TaakHelden)
# OWNER: AI Engineering Lead

Follow `.claude/skills/COMMON_RULES.md` for global constraints.
Edge ownership: see `.claude/skills/HANDOFFS.md` (AI edges E27–E30).

> **Status: not yet built.** TaakHelden ships **no AI today** — no LLM calls, no embeddings,
> no RAG. This skill is the standard to follow *if* an AI feature is ever approved (by PO +
> `taakhelden-ai-strategy`). Absent AI work, there is nothing to do here.

## Role
If AI is added, you build it **well** within the edge constraints: prompts, output
validation, evals, guardrails, and the cost/latency envelope. `ai-strategy` decides
whether/what; `backend` builds the route/auth/DB plumbing; you own the AI craft between.

## Non-negotiables (if AI is ever added)

```
1. Workers AI only — c.env.AI.run('@cf/...'). NEVER Anthropic/OpenAI/external SDK or REST.
2. Child privacy is absolute — no child name, e-mail, photo, or identity ever reaches a model.
3. AVG/GDPR — AI over personal data respects consent + data minimisation.
4. Positive tone — any child-facing generated text follows §3.7 (route via @dutch-child-copy).
5. Validate every output — parse + Zod (packages/shared) + safe fallback. Never trust raw text.
6. Every call has a timeout + retry + graceful-degradation path (never a 500 on bad output).
```

## Output validation pattern

```typescript
const res = await c.env.AI.run(MODEL, { messages })
const parsed = SomeSchema.safeParse(extractJson(res.response))
if (!parsed.success) return degradeGracefully()   // log (no PII), fall back — don't 500
```

## Evals
Keep a small fixed eval set; measure before/after (usefulness + format-valid rate) for any
prompt/model change. No eval evidence → does not ship.

## Guardrails
- **No child PII in prompts** — strip/omit identifying data; prefer aggregates.
- **Prompt injection** — treat any user/child input as untrusted; it must never override system instructions or reach another family's data.
- **Family isolation** — any retrieval/filter scopes to the caller's family.

## Quality gates (if AI is ever added)
- [ ] No prompt can contain a child's name/photo/identity
- [ ] Output Zod-validated with a safe fallback
- [ ] Child-facing generated copy reviewed by `@dutch-child-copy`
- [ ] Eval before/after recorded
- [ ] Timeout + retry + degradation on every call

## Do not
- Call any external LLM — Workers AI only.
- Trust raw model output.
- Write general routes/auth/DB plumbing — hand that to backend (E28).
- Add AI to the product on your own initiative — that's a PO + architect decision.
