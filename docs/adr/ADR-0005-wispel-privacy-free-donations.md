# ADR-0005: Wispel — privacy first, free + donations, domain map

- Status: accepted
- Date: 2026-07-30
- Affects: product canon, marketing, App Store listing, `apps/web`, `apps/ios`, `apps/api` (email/from), infra cutover
- Related: [`docs/wispel-rebrand-and-ui-plan.md`](../wispel-rebrand-and-ui-plan.md), [`docs/wispel-build-plan-workstreams.md`](../wispel-build-plan-workstreams.md) §13
- Supersedes: freemium sketch in `docs/taakhelden-productvoorstel.md` §7 (historical)

## Context

The product was drafted as **TaakHelden** with a freemium model (free tier caps + paid family subscription). Competitive review against [ChoreHero](https://www.chorehero.cloud) and an explicit product decision (2026-07-30) require a different public promise:

1. Rebrand to **Wispel** on **wispel.cc** (escape the English “chore/task hero” naming lane).
2. **Privacy first** as a brand and engineering pillar — not only a compliance appendix.
3. **Free for families**, sustained by optional **donations**, not subscriptions or timed trials.

Leaving freemium language in the productvoorstel causes agents and marketers to implement the wrong model.

## Decision

### 1. Product name and domain

| Item | Decision |
| --- | --- |
| Product name | **Wispel** (not “wispel.cc” in app chrome) |
| Primary domain | **wispel.cc** |
| Intended hosts | `www.wispel.cc` marketing · `app.wispel.cc` parent dashboard · `api.wispel.cc` API |
| Anti-positioning | Not a ChoreHero / “Hero” clone; avoid Held/Hero vocabulary in new copy (open point O1 for exact replacement terms) |

Codebase folder names, Worker names, and historical doc filenames may still say `taakhelden` until workstreams WS-STRINGS / WS-INFRA; **user-facing and canon docs must say Wispel**.

### 2. Privacy first

| Rule | Decision |
| --- | --- |
| Ads | None |
| Child-facing third-party trackers / ad SDKs | Forbidden |
| Parent analytics | Only privacy-friendly, EU-hosted, anonymised if used at all |
| Public privacy | Plain-language `/privacy` (and App Store nutrition labels) are required for Horizon A |
| Existing hard rules | Child PII, EXIF strip, no name/photo URL logging — unchanged (CLAUDE.md) |

### 3. Free + donations (replaces freemium)

| Rule | Decision |
| --- | --- |
| Core family features | **Free** — no subscription, no trial paywall, no “Family plan” gate |
| Feature gates tied to payment | Forbidden |
| Sustainability | Optional **donations** (one-time and/or monthly) |
| Where donations appear | Marketing `/steun`, parent web settings, iOS **parent mode** settings only |
| Child surfaces | **Never** show donation UI or copy (Mijn Dag / Winkel / Mijn Held) |
| Copy tone | Gratitude, not guilt |
| In-app purchase donations | Prefer **external** `/steun` checkout; IAP only if Apple policy forces it (open O21 — recommend no) |

**Still open (do not block Horizon A):** donation provider (O18), legal entity (O19), suggested amounts (O20). Thin marketing may use a steun placeholder (“binnenkort” / mailto).

### 4. Bundle ID (provisional)

| Situation | Decision |
| --- | --- |
| App Store Connect record already exists under `nl.taakhelden.*` | **Keep** bundle ID; change **display name** to Wispel only |
| No live App Store record yet | Prefer **`cc.wispel.family`** (or `cc.wispel.app`) for new registration |

Final choice is open point **O10** — confirm against App Store Connect before WS-INFRA / SIWA URL cutover. This ADR locks the *policy*, not a single hard-coded bundle string until O10 is logged.

### 5. Marketing conversion

Primary CTA is **“Start met je gezin — gratis”** (or EN equivalent), not “Start 14-day trial”. No pricing table of subscription tiers on `wispel.cc`.

## Consequences

| Area | Change |
| --- | --- |
| Productvoorstel §7 / §9 | Updated to free + donations; freemium retired |
| CLAUDE.md / AGENTS.md / README | Point at Wispel plans; state privacy + free principles |
| Marketing (WS-WEB-MKT) | Gratis + privacy pillars; `/steun` not `/prijzen` |
| WS-DONATE | Implements provider later; must stay parent-only |
| WS-STRINGS | Rename user-facing TaakHelden → Wispel |
| Monetization code | None today; do not add Stripe/etc. until O18–O19 decided |
| Existing architecture | Unchanged (Workers/D1/R2/FamilyRoom) |

## Non-goals

- Implementing donation checkout in this ADR
- Renaming Cloudflare Workers / D1 in this ADR (WS-INFRA)
- Final mascot or illustration system (O7 / O12)
- Rewriting historical batch-plan filenames

## Exit criteria

- [x] Productvoorstel no longer describes freemium caps or premium subscription
- [x] CLAUDE.md states Wispel + privacy first + free/donations and links build plan
- [ ] O10 bundle ID logged in build plan §13.7 after App Store Connect check
- [ ] O18–O19 decided before WS-DONATE coding starts
