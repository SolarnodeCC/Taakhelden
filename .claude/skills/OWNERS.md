# Prompt Asset Ownership Matrix (TaakHelden)

Edge ownership (handoffs between these roles) lives in [`HANDOFFS.md`](./HANDOFFS.md); the
global constraints every role follows live in [`COMMON_RULES.md`](./COMMON_RULES.md). This
matrix maps every agent and skill file to its owning role. Keep it in sync by hand: every
file in `.claude/agents/` and `.claude/skills/` (except the `endpoint-scaffold/` skill
folder) should appear here, and every entry should map to a real file.

## Agents (`.claude/agents/`)

### TaakHelden-native (pre-existing, unchanged)
- `architecture-reviewer.md` — Architecture Reviewer (the six-hard-rules gate, `/arch-check`)
- `dutch-child-copy.md` — Dutch Child Copy (positive child-facing NL text, §3.7)
- `migration-writer.md` — Migration Writer (new numbered D1 migrations)

### Core delivery
- `architect-agent.md` — Architect (`taakhelden-architect`)
- `backend-agent.md` — Backend Lead (`taakhelden-backend`)
- `frontend-agent.md` — Web Lead (`taakhelden-web`)
- `ios-agent.md` — iOS Lead (`taakhelden-ios`)
- `devops-agent.md` — DevOps (`taakhelden-devops`)
- `tester-agent.md` — QA Lead (`taakhelden-tester`)
- `e2e-tester-agent.md` — E2E/Perf QA (`taakhelden-e2e`)
- `cso-agent.md` — Security (`taakhelden-security`)
- `i18n-agent.md` — i18n (`taakhelden-i18n`)

### Product & knowledge
- `po-agent.md` — Product Owner (`taakhelden-product-owner`)
- `knowledge-agent.md` — Knowledge Lead (`taakhelden-knowledge`)
- `analytics-agent.md` — Analytics (`taakhelden-analytics`)

### Growth & AI (advisory / not-yet-built — see each agent's status note)
- `marketing-agent.md` — Growth Lead (`taakhelden-marketing`)
- `sales-agent.md` — Partnerships Lead (`taakhelden-sales`)
- `seo-reviewer-agent.md` — SEO Reviewer (`taakhelden-seo-reviewer`)
- `market-research-agent.md` — Market Research (`taakhelden-market-research`)
- `ai-engineer-agent.md` — AI Engineering (`taakhelden-ai-engineer`)
- `ai-strategy-agent.md` — AI Strategy (`taakhelden-ai-strategy`)

## Skills (`.claude/skills/`)

### Cross-cutting scaffolding
- `COMMON_RULES.md` — Architect (global constraints for every role)
- `HANDOFFS.md` — Architect (the edge map)
- `OWNERS.md` — Architect (this matrix)

### Depth docs (each backs the like-named agent)
- `architect.md` — Architect
- `backend-dev.md` — Backend Lead
- `backend-integrations.md` — Backend Lead
- `backend-perf.md` — Backend Lead
- `frontend-dev.md` — Web Lead
- `ios-dev.md` — iOS Lead
- `devops.md` — DevOps
- `tester.md` — QA Lead
- `e2e-tester.md` — E2E/Perf QA
- `investigate.md` — QA Lead / Backend (FamilyRoom/WS debug protocol)
- `review.md` — QA + Security (pre-merge gate)
- `cso.md` — Security
- `i18n.md` — i18n
- `knowledge.md` — Knowledge Lead
- `analytics.md` — Analytics
- `product-owner.md` — Product Owner
- `release-notes.md` — Product Owner / Growth Lead
- `marketing.md` — Growth Lead
- `sales.md` — Partnerships Lead
- `seo-reviewer.md` — SEO Reviewer
- `market-research.md` — Market Research
- `market-research-templates.md` — Market Research
- `ai-engineering.md` — AI Engineering
- `ai-strategy.md` — AI Strategy

### Invokable TaakHelden skill (folder)
- `endpoint-scaffold/` — the native four-layer endpoint scaffold (`SKILL.md` +
  `references/templates.md`). Not part of the role matrix above; owned by Backend Lead.
