# Wispel (`wispel.cc`) — rebrand & UI improvement plan

**Status:** planning only — no implementation in this PR  
**Date:** 2026-07-30  
**Inputs:** UI review (web + iOS), productvoorstel §4, Design System kits, current `apps/web` + `apps/ios` shipping UI  
**Goal:** Rename the product from **TaakHelden** to **Wispel** on domain **wispel.cc**, and execute the critical UI recommendations so brand, marketing, and emotional product loops match the promise.

**Locked product principles (2026-07-30):**
- **Privacy first** — EU hosting, minimal data, no ads, no child tracking, plain-language privacy on marketing and in-app.
- **Free for families** — no subscription paywall; sustain via **donations** (optional, parent-only, never shown to children).

These supersede the freemium/premium sketch in `docs/taakhelden-productvoorstel.md` §7 for Wispel direction. **WS-DOCS (2026-07-30):** productvoorstel patched; see [ADR-0005](./adr/ADR-0005-wispel-privacy-free-donations.md).

**Executable build plan:** [`wispel-build-plan-workstreams.md`](./wispel-build-plan-workstreams.md) — horizons, workstreams, PR sequence, anti-goals.  
**Open points (canonical):** [`wispel-build-plan-workstreams.md` §13](./wispel-build-plan-workstreams.md#13-open-points-register-canonical) — locked L1–L6, open O1–O34.

---

## 0. Brand decisions to lock before coding

| Decision | Recommendation | Owner must confirm |
| --- | --- | --- |
| **Product name** | **Wispel** (not “wispel.cc” in chrome) | Yes |
| **Domain** | `wispel.cc` — primary marketing + web app | Yes |
| **Subdomains** | `www.wispel.cc` → marketing; `app.wispel.cc` → parent dashboard; `api.wispel.cc` → Worker API | Confirm |
| **App Store display name** | Wispel | Confirm |
| **Bundle ID** | Prefer `cc.wispel.family` (or keep `nl.taakhelden.*` if already submitted — see §1.3) | Confirm |
| **Voice** | Keep positive NL child copy (§3.7); invent Wispel-native hero language to replace “TaakHeld(en)” | Confirm |
| **Mascot** | Decide: revive “Vinkie” under Wispel, or design a new Wispel mascot — do not ship emoji-as-mascot | Confirm |
| **Tagline direction** | Playful Dutch fit (“wispelen” = fidget/play) — one short parent promise, not a slogan pile | Marketing |
| **Anti-positioning** | Explicitly **not** an English “ChoreHero” clone — see Appendix C | Product + Marketing |
| **Privacy** | **Privacy first** — locked. No ads; no third-party trackers in child surfaces; EU data; plain-language privacy as a marketing pillar | Locked |
| **Pricing / sustain** | **Free for families**; optional **donations** (parent-only). No freemium tiers, no timed trial paywall | Locked |

### Naming glossary (use everywhere user-facing)

| Old | New |
| --- | --- |
| TaakHelden | Wispel |
| taakhelden.nl / workers.dev staging hosts | wispel.cc (+ staging hosts) |
| “TaakHeld” (level / celebration copy) | New **Wispel-native** term — avoid “Held/Hero” (see Appendix C); pick one in Phase 0 |
| Email from / legal entity strings | `@wispel.cc` |

### What does *not* need to rename on day one

- Cloudflare **resource IDs** (D1 `database_id`, R2 bucket contents) — rename *bindings/names* carefully; IDs stay.
- Historical git history / merged PR titles.
- ADR filenames can keep numbers; update *content* to say Wispel.
- Internal Cursor agent ids (`taakhelden-*`) — optional follow-up; not user-facing.

---

## 1. Phase map (order is intentional)

```mermaid
flowchart TD
  P0[Phase 0: Brand lock + vocabulary]
  P1[Phase 1: Infra + legal rename]
  P2[Phase 2: Codebase string rename]
  P3[Phase 3: Brand foundation UI]
  P4[Phase 4: Marketing site wispel.cc]
  P5[Phase 5: iOS emotional loops]
  P6[Phase 6: Parent web craft]
  P7[Phase 7: Cross-surface story]

  P0 --> P1 --> P2
  P0 --> P3
  P2 --> P4
  P3 --> P4
  P2 --> P5
  P3 --> P5
  P2 --> P6
  P3 --> P6
  P5 --> P7
  P6 --> P7
  P4 --> P7
```

| Phase | Outcome | Depends on |
| --- | --- | --- |
| **0** Brand lock | Name, domain map, hero vocabulary, palette brief, logo brief | — |
| **1** Infra rename | DNS, Workers, Apple ids, email, secrets | Phase 0 |
| **2** Codebase rename | All user-facing + package/worker display names say Wispel | Phase 1 decisions |
| **3** Brand foundation | Real mark, final palettes, icon/avatar system | Phase 0 brief |
| **4** Marketing | Public `wispel.cc` landing that passes the brand test | Phase 2 + 3 |
| **5** iOS loops | Shop redeem, Mijn Dag hero, Mijn Held, age modes | Phase 2 + 3 |
| **6** Web craft | Less card noise, primitives, Inzichten ship-or-hide, motion | Phase 2 + 3 |
| **7** Cross-surface | Shared celebration language, kits ↔ shipping aligned | Phase 5 + 6 |

Do **not** polish bordered lists before Phase 0–3. Identity first, then loops, then craft.

---

## 2. Phase 0 — Brand lock (design + product, little code)

### 2.1 Deliverables
1. **One-pager brand sheet:** name, pronunciation, do/don’t, parent promise (1 sentence), child promise (1 sentence), **privacy promise (1 sentence)**, **free + donations line (1 sentence)**.
2. **Visual brief:** final kid / teen / parent hex; when yellow is used; shared kinship rule (same mark + family accent across registers).
3. **Logo brief:** wordmark + optional mark; light/dark; app icon variants.
4. **Vocabulary table:** replace every “TaakHeld(en)” string with Wispel equivalents (NL + EN).
5. **Illustration brief:** avatar system (not emoji), task category icons, optional mascot.
6. **Donation UX brief:** where parents can support Wispel (marketing `/steun`, in-app settings only); copy that never guilt-trips; never visible on child tabs.

### 2.2 Hard rules from the UI review (carry into the brief)
- Parent register stays calm (no coral chrome, no confetti in dashboard chrome).
- Kid register stays warm/round; teen must change radius/type/ornament — not only navy fill.
- No purple-on-white / cream-serif terracotta clichés on marketing.
- Landing first viewport: brand + one headline + one sentence + CTA + one dominant product visual — nothing else.
- **Do not mirror ChoreHero’s English “Hero” chore-SaaS pattern** (see Appendix C): avoid EN hero-noun branding, cream+#blue generic family-SaaS look, and a marketing site that only sells parent pain with zero kid warmth.
- **Privacy-first and free** are brand pillars, not footnotes — say them early on marketing; never hide a paywall behind “full household access.”
- Donations are **opt-in gratitude**, never a feature gate; children never see donation UI.

### 2.3 Exit criteria
- Stakeholders signed off on glossary + palette + logo direction.
- Copy spreadsheet ready for eng to find-replace user strings.
- Donation + privacy promises signed off for marketing and App Store listing.

---

## 3. Phase 1 — Infrastructure & legal rename

### 3.1 Domain & DNS (`wispel.cc`)
| Host | Purpose |
| --- | --- |
| `wispel.cc` / `www` | Marketing landing (Phase 4) |
| `app.wispel.cc` | Next.js parent dashboard |
| `api.wispel.cc` | Hono Worker `/v1` |
| Optional `cdn` / R2 custom domain | Presigned photo URLs later |

Also: SPF/DKIM/DMARC for transactional mail from `@wispel.cc`.

### 3.2 Cloudflare Workers / bindings
Current → target (staging then prod):

| Current | Target |
| --- | --- |
| Worker `taakhelden-api` | `wispel-api` |
| Worker `taakhelden-web` | `wispel-web` |
| D1 `taakhelden-db` | `wispel-db` (new name; same data via migration/copy — **do not rewrite historical migrations**) |
| R2 `taakhelden-photos` | `wispel-photos` (or keep bucket, change public naming only) |
| `APP_BASE_URL`, service bindings, `API_BASE_URL` | Point at `*.wispel.cc` |

Document rollback: keep old Workers names as aliases until DNS cutover is green.

### 3.3 Apple / App Store
| Item | Action |
| --- | --- |
| Display name | Wispel |
| Bundle ID | New `cc.wispel.family` **only if not yet live**; if App Store record exists under `nl.taakhelden.*`, keep bundle ID and change display name only |
| SIWA Services ID / redirect URLs | Update to `wispel.cc` / `app.wispel.cc` |
| Associated Domains / Universal Links | `applinks:wispel.cc`, `applinks:app.wispel.cc` |
| Privacy policy / support URLs | Host on `wispel.cc` |

### 3.4 Exit criteria
- Staging API + web reachable on Wispel hosts.
- SIWA / email smoke tests pass against new domains.
- Bundle ID strategy written in an ADR.

---

## 4. Phase 2 — Codebase rename (systematic)

Work in **small PRs** to keep CI green. Suggested order:

### PR A — User-facing strings only
- `apps/web/messages/{nl,en}.json`
- Auth pages wordmark / metadata titles
- iOS `Localizable.xcstrings` / `String(localized:)` catalogs
- Email templates (`apps/api/src/services/email.ts`, notifier copy)
- Privacy / settings legal strings that name the product

### PR B — App chrome & packaging
- `apps/web` metadata, Open Graph, `layout.tsx` titles
- `apps/ios/project.yml` `PRODUCT_NAME`, scheme names (folder rename optional later)
- Design System wordmark specimens
- `docs/*` product name references (canonical docs first; batch history can stay)

### PR C — Package / Worker / repo identifiers
- Root `package.json` name → `wispel`
- `wrangler.toml` / `wrangler.jsonc` worker names + env URLs
- OpenAPI title (`TaakHelden core API` → `Wispel core API`)
- Shared package display strings; regenerate Swift contract
- CI workflow display names

### PR D — Repo / path renames (optional, highest risk)
- `apps/ios/TaakHelden/` → `apps/ios/Wispel/` (XcodeGen + CI paths)
- Doc filenames `taakhelden-*.md` → `wispel-*.md` with redirects/links updated
- Only after A–C are stable

### Rename inventory (non-exhaustive; eng must `rg`)

| Area | Examples |
| --- | --- |
| Web UI | Login `h1`, AppShell brand, metadata |
| iOS | `PRODUCT_NAME`, unlock/welcome titles, widget |
| API | OpenAPI title, email subject lines, push payloads |
| Infra | Worker names, `APP_BASE_URL`, Apple client ids |
| Docs / DS | Productvoorstel header, Design System readme |
| Tests | Assertions on product name strings |

### Exit criteria
- `rg -i 'taakhelden|TaakHelden'` returns **zero user-facing** hits (code comments/history OK if documented).
- Typecheck + test suites green; iOS scheme builds as Wispel.

---

## 5. Phase 3 — Brand foundation UI (P0 from review)

Maps to review recommendations **1–3**.

| # | Work item | Surfaces |
| --- | --- | --- |
| 3.1 | Implement logo/mark (SVG web + PDF/PDF asset iOS + App Icon set) | Web, iOS, marketing |
| 3.2 | Promote kid/teen hex from “placeholder” → final in `globals.css`, Design System tokens, `THPalettes` | Shared tokens |
| 3.3 | Kinship rule in CSS/Swift: shared accent + mark; parent calm / kid warm / teen muted | Both |
| 3.4 | Icon set for chrome (stroke, rounded); retire emoji for UI chrome | Both |
| 3.5 | Avatar illustration library v1 (diverse; wheelchair/glasses/gender-neutral) | iOS first |
| 3.6 | Use yellow intentionally (streaks, milestones) — not as random fill | iOS + DS kits |

### Exit criteria
- Brand test: remove nav chrome on marketing/auth — still recognizably Wispel.
- `globals.css` no longer labels kid/teen as placeholder.
- Design System readme updated to “shipping brand”, not “inferred”.

---

## 6. Phase 4 — Marketing site on `wispel.cc` (P1)

Maps to review recommendations **4–6**.

### 6.1 Routes
| Route | Purpose |
| --- | --- |
| `/` (or locale `/nl`, `/en`) | Landing — brand-first hero |
| `/privacy`, `/voorwaarden` | Legal (App Store + AVG) — **plain-language privacy** is a product pillar, not legalese-only |
| `/login` → `app.wispel.cc/...` | Deep link / redirect to dashboard |
| `/gratis` or in-page “Gratis & steun” | **Free forever** story + optional donations (replaces pricing/freemium page) |
| `/steun` | Donation landing (parent-facing; Stripe/iDEAL or similar — no child surface) |
| Optional `/demo` or in-page interactive | Parent↔child loop walkthrough (learn from ChoreHero; do not clone their copy) |
| Optional SEO guides (NL) | Later: “klusjes-app”, “beloningssysteem kinderen” — after core landing ships |

### 6.2 Landing composition (hard constraints)
- **One composition** in first viewport: Wispel mark (hero-level) + one headline + one supporting sentence + CTA group + **one full-bleed product visual** (child phone / family moment).
- No cards in hero; no stat strips; no pill clusters; no overlay badges on hero media.
- Expressive type (not Inter/system for marketing); atmosphere via gradient/pattern/image — not flat white.
- Primary CTA: “Start met je gezin — gratis” → register on `app.wispel.cc`.
- Secondary: App Store badge when iOS build is public; tertiary soft link “Steun Wispel” (never competing with primary).
- **Below the fold (Phase 4 completeness — acquisition depth, Wispel voice):** how-it-works in **our** loop language; real product screenshots; **privacy-first** section; **gratis + donaties** section (not a price table); short FAQ; who it’s for / not for; final CTA. Do not ship a hero-only brochure.
- **Differentiation vs ChoreHero:** show kid delight *and* parent calm; NL-first; homework + huiswerk as first-class; no “tired of reminding” clone headline; marketing↔app brand kinship; **free + privacy** instead of trial + subscription.

### 6.3 Auth upgrade
- Replace flat centered form with branded entry (atmosphere + mark + one promise line).
- Keep parent calm register — do not paste kid coral into login chrome.
- Language switcher available on auth (today missing).

### 6.4 App Store / Welcome
- Welcome hub shows a short preview of kid warmth (cream/coral/celebration) while remaining family/parent-led for SIWA.

### Exit criteria
- `wispel.cc` loads landing on mobile + desktop.
- Auth no longer fails the brand test.
- SEO basics: title/description NL+EN, OG image with mark.
- Landing states clearly: **gratis**, **privacy first**, optional **steun/donatie** (parent-only).
- No pricing table, trial countdown, or freemium feature matrix on the site.

---

## 6A. Privacy-first & donations (cross-cutting)

Applies to Phases 0, 1, 4, 6, and App Store listing.

### Privacy-first rules
1. No ads; no ad SDKs; no child-facing third-party analytics.
2. Parent analytics only if privacy-friendly, EU-hosted, anonymised (existing productvoorstel direction).
3. Marketing and App Store lead with plain-language privacy (what we collect / don’t; photo expiry; EU hosting).
4. Child PII rules unchanged (no child email; EXIF strip; never log names/photo URLs).
5. Donation providers must not inject trackers into child surfaces (donate only from marketing or parent settings).

### Free + donations rules
1. **All core family features free** — no child caps that unlock behind payment; no “Family plan” paywall.
2. Optional donations: one-time and/or monthly; NL-friendly payment (e.g. iDEAL) preferred.
3. Donation entry points: `wispel.cc/steun`, parent web settings, iOS parent mode settings — **never** Mijn Dag / Winkel / Mijn Held.
4. Copy: gratitude, not guilt (“Als Wispel jullie helpt, mag je ons steunen” — never “Anders verdwijnt de app”).
5. Update product docs: replace freemium § in productvoorstel with this model when implementation starts.
6. App Store: list as Free; use External Link / donation disclosure per Apple guidelines if linking out to donate.

### Work items to schedule
| Item | Where |
| --- | --- |
| Donation provider choice + legal (stichting/eenmanszaak) | Phase 0 / business |
| `/steun` + footer link | Phase 4 |
| Parent settings “Steun Wispel” | Phase 6 (web) + iOS parent mode |
| App Store privacy nutrition labels + free listing copy | Phase 1–4 |
| Kill freemium language in docs/messages | Phase 2 |
## 7. Phase 5 — iOS emotional loops (P2)

Maps to review recommendations **7–11**.

| Priority | Item | Detail |
| --- | --- | --- |
| 5.1 | **Winkel complete** | Redeem CTA (API already exists), affordability, **spaardoel** ProgressBar (“Nog X tot …”), RewardCard grid |
| 5.2 | **Mijn Dag hero header** | Avatar + points + streak (match product §4.1 + DS kit) |
| 5.3 | **Mijn Held elevate** | Milestone badges, clearer level story, less parent-gate-as-hero |
| 5.4 | **Teen differentiation** | Radius ~12, system/default type bias, mint confetti, less ornament |
| 5.5 | **Young mode pass** | Near-textless, picture-first, TTS-first, large targets — before marketing 4–7 |
| 5.6 | **Pairing polish** | Large code boxes + QR (bouwvoorstel), numeric pad consistency |

### Exit criteria
- Child can browse → save toward → redeem a reward end-to-end.
- Mijn Dag header matches kit composition.
- Teen and young modes pass a visual QA checklist (separate from mid).

---

## 8. Phase 6 — Parent web craft (P3)

Maps to review recommendations **12–15**.

| Priority | Item | Detail |
| --- | --- | --- |
| 6.1 | Reduce border/card monotony | Borders only where interaction needs a container; clearer Vandaag hierarchy |
| 6.2 | Primitive consistency | Use `Button` / `Badge` / `ProgressBar`; wire or delete dead kid components |
| 6.3 | **Inzichten: ship or hide** | Remove from nav until Batch/Fase 2 ships; never leave stub in primary nav |
| 6.4 | Intentional motion (2–3) | Approval success, reward fulfilled — quiet echo of celebration, not kid confetti |
| 6.5 | Empty states | Illustration + Wispel voice; keep positive framing |

### Exit criteria
- No primary-nav stubs.
- Lint/design-check: no new raw hex where tokens exist; primitives used.
- Parent UI still calm — no kid register bleed.

---

## 9. Phase 7 — Cross-surface story (P4)

Maps to review recommendations **16–18**.

1. **Align Design System kits ↔ shipping** — update kits to Wispel brand; mark aspirational screens clearly OR bring shipping up to kit.
2. **Shared celebration language** — when parent approves / fulfills on web, show a restrained success moment that *echoes* iOS (color flash / check), not a different personality.
3. **Inzichten tone** — conversation-help layout, never surveillance dashboard (when shipped).
4. **Docs hygiene** — CLAUDE.md, AGENTS.md, Design System readme, productvoorstel header all say Wispel + `wispel.cc`.

### Exit criteria
- New designer/engineer reading DS + apps sees one brand.
- Marketing screenshots match the live app within one release.

---

## 10. Explicit non-goals / anti-patterns

- Do not coral-wash the parent dashboard.
- Do not ship a teal SaaS template landing with a wordmark swap.
- Do not treat DS kits as “done” while production lags.
- Do not rewrite historical D1 migrations; add new numbered migrations only.
- Do not market to 4–7 until young-mode pass lands.
- Do not change ledger / no-negative-mechanics rules as part of rebrand.

---

## 11. Workstream ownership (suggested)

| Workstream | Primary agents / roles |
| --- | --- |
| Brand lock + copy | Product Owner + Marketing + `@dutch-child-copy` |
| Domain / Workers / DNS | `@taakhelden-devops` (rename later) |
| String rename web | `@taakhelden-web` + `@taakhelden-i18n` |
| String rename API / email | `@taakhelden-backend` |
| iOS rename + loops | `@taakhelden-ios` |
| Design tokens / UI craft | `@taakhelden-web` + design-system skill + `/design-check` |
| Landing page | `@taakhelden-web` + `@taakhelden-marketing` + `@taakhelden-seo-reviewer` |
| Docs / ADRs | `@taakhelden-knowledge` + `@taakhelden-architect` |
| Security of new domains / SIWA | `@taakhelden-security` |

---

## 12. Suggested PR / release sequence

1. **Docs:** this plan + ADR for bundle ID / domain map  
2. **Phase 0** artifacts in `Design System/` (palette + wordmark cards)  
3. **Phase 1** staging cutover on Cloudflare  
4. **Phase 2A–C** rename PRs  
5. **Phase 3** brand assets wired into web + iOS  
6. **Phase 4** landing on `wispel.cc`  
7. **Phase 5** iOS shop + hero + held (can parallelize with 6 after 3)  
8. **Phase 6** web craft + hide Inzichten  
9. **Phase 7** kit sync + celebration echo + doc sweep  
10. **Prod DNS cutover** + App Store metadata update  

---

## 13. Success metrics (qualitative + light quantitative)

| Signal | Target |
| --- | --- |
| Brand test (landing/auth) | Pass without relying on nav alone |
| Child redeem funnel | Browse → pin → redeem works on device |
| Parent trust | No stub nav items; calm register intact |
| Name consistency | Zero user-facing “TaakHelden” in app/web/email |
| Store / web first impression | Wispel mark + promise readable in &lt;3s |
| Privacy promise findable | Plain-language privacy on landing + App Store without hunting |
| Pricing confusion | Zero subscription/trial CTAs; “gratis” is unambiguous |
| Donation hygiene | No donation UI on child tabs; parent-only paths only |

---

## 14. Open questions → canonical register

Open points are maintained in **[`wispel-build-plan-workstreams.md` §13](./wispel-build-plan-workstreams.md#13-open-points-register-canonical)** (locked L1–L6, open O1–O34, decision log).

Summary of what still needs an owner answer before coding spreads:

| Priority | IDs | Theme |
| --- | --- | --- |
| Gate G0 | O1–O12 | Vocab, palette, mark, mascot postpone?, marketing hosting, bundle ID, taglines |
| Horizon A defaults OK | O13–O17 | Staging host, hide Inzichten, token owner, defer demo |
| Donate only | O18–O22 | Provider, legal entity, amounts, no IAP, placeholder OK |
| Cutover only | O23–O28 | Workers rename, aliases, folder/doc rename defer, email/SIWA |
| Backlog | O29–O34 | SEO, young polish, token package, agent renames, pedagogy review |

Historical list (superseded by the register above):

1. Exact vocabulary replacing “TaakHeld” — see **O1**
2. Bundle ID — **O10**
3. Mascot — **O7**
4. Marketing same Next vs separate — **O8**
5. Staging hostname — **O13**
6. ~~Freemium vs trial~~ → locked **L4**; provider/entity → **O18–O19**
7. Interactive demo — **O14**
8. Donation amounts — **O20**

---

## Appendix A — Recommendation → phase traceability

| Review recommendation | Phase |
| --- | --- |
| 1 Brand pass (logo, palettes, illustration) | 0 + 3 |
| 2 Kinship rule across registers | 0 + 3 |
| 3 Kill emoji-as-brand for chrome/avatars | 3 + 5 |
| 4 Dutch parent landing | 4 |
| 5 Upgrade auth | 4 |
| 6 Welcome / Store warmth preview | 4 + 5 |
| 7 Winkel redeem + spaardoel | 5 |
| 8 Mijn Dag hero header | 5 |
| 9 Elevate Mijn Held | 5 |
| 10 Teen differentiation | 5 |
| 11 Young-mode pass | 5 |
| 12 Reduce web card noise | 6 |
| 13 Use primitives consistently | 6 |
| 14 Ship or hide Inzichten | 6 |
| 15 Parent motion | 6 |
| 16 Align kits ↔ shipping | 7 |
| 17 Shared celebration language | 7 |
| 18 Pedagogical trust in Inzichten UI | 7 (+ later Insights build) |
| Rename product → Wispel / wispel.cc | 0–2 (+1 infra) |
| Privacy-first + free / donations model | 0 + 4 + 6A (cross-cutting) |

## Appendix B — Current footprint (for eng)

High-signal rename targets already identified:

- `package.json` `"name": "taakhelden"`
- `apps/api/wrangler.toml` → `taakhelden-api`, `taakhelden-db`, `taakhelden-photos`, Apple ids
- `apps/web/wrangler.jsonc` → `taakhelden-web`, service binding `taakhelden-api`
- `apps/ios/project.yml` → `PRODUCT_NAME`, `nl.taakhelden.family`, API URLs
- Web login wordmark; iOS schemes `TaakHelden`
- OpenAPI title; docs `taakhelden-*.md`; Design System readme
- Email/notifier strings in `apps/api/src/services/`

Use `rg -i 'taakhelden|TaakHelden|TaakHeld'` as the living checklist until Phase 2 exit.

---

## Appendix C — Competitive review vs [ChoreHero](https://www.chorehero.cloud) (2026-07-30)

**Verdict on our plan:** Directionally right, and the Wispel rename is *more* urgent than the UI polish alone. TaakHelden ≈ “Task Heroes” sits in the same semantic lane as **ChoreHero**. Keeping “Held/Hero” vocabulary after rebrand would still lose the differentiation battle. The plan’s Phase 4 must expand from “pretty landing” to **acquisition completeness**, while Phase 0 must lock an anti-ChoreHero brand wedge.

### C.1 What ChoreHero is (relevant facts)

| Dimension | ChoreHero |
| --- | --- |
| Domain pattern | `www.chorehero.cloud` marketing → `app.chorehero.cloud` product (same split our plan proposes) |
| Positioning | Parent pain: “families tired of reminding”; parent-managed plan → proof → approve → reward |
| Marketing tone | Rational, English, SaaS-calm; little kid delight on the public site |
| Visual | Cream field, professional blue (~`#3B5EDE`), navy type, system/Inter-like sans, product phone/Mac mockups |
| Conversion | Primary CTA = **14-day trial**; pricing ($6.99/mo / $69.99/yr) on the marketing page |
| Acquisition depth | How-it-works, interactive-ish demo narrative, proof/approvals story, privacy plain-language, pricing, FAQ, SEO “facts for AI”, comparison/use-case guides, for/not-for |
| Brand consistency | Weak: marketing is minimal truck-ish mark; app login uses a louder comic “CHORE HERO” wordmark — **marketing ≠ product personality** |
| Feature claims | Photo/video proof, auto-assignment, Alexa/integrations, AI assistant, up to 20 “heroes” |

### C.2 Overlap with Wispel / our current product

| Shared loop | Risk if we copy their marketing |
| --- | --- |
| Parent plans chores/tasks | We look like “NL ChoreHero” |
| Kid completes + optional photo proof | Commodity category story |
| Parent approves → points/rewards | Identical funnel narrative |
| Streaks / celebration | Expected, not differentiating |
| Parent web + child device | Same architecture story |

**Structural overlap is real.** Differentiation cannot be the loop — it must be **name, market, tone, pedagogy, and emotional craft**.

### C.3 Where our plan already beats / correctly diverges

| Plan choice | Why it matters vs ChoreHero |
| --- | --- |
| Rename away from TaakHelden | Escapes literal “chore/task hero” collision |
| Brand-first hero, no card clutter | Their first viewport is denser (eyebrow + bullets + feature chips); our constraint is stricter and better |
| Kinship rule marketing↔app | They fail brand consistency; we treat it as P0 |
| Kid warmth + parent calm registers | Their marketing undersells kid delight; our product promise includes it |
| Positive copy / no negative mechanics | Pedagogical wedge they don’t own (and some competitors explicitly deduct points) |
| NL-first + homework | Geographic + use-case wedge (huiswerk), not US chore-SaaS |
| Age modes (young/mid/teen) | Deeper kid UX than “one simplified child view” marketing |
| **Privacy first + free / donations** | Hard contrast to trial + $6.99 Family subscription; trust wedge for NL parents |

### C.4 Gaps in our plan that ChoreHero exposes

| Gap | Plan amendment |
| --- | --- |
| Phase 4 under-scoped (hero + auth only) | Add FAQ, for/not-for, **privacy-first**, **gratis + steun**, real screenshots, final CTA as **Phase 4 must-haves** |
| No interactive demo | Add optional `/demo` or in-page loop walkthrough |
| Weak SEO / comparison content | Schedule NL SEO guides *after* core landing — don’t skip forever |
| CTA monetization unclear | **Locked: free + donations** — do not add trial/price table |
| “Held” still listed as vocab option | **Deprecate hero-noun options**; prefer Wispel-native terms |
| Cream marketing risk | Kid cream `#FFF8EC` ≈ their marketing cream — do **not** use near-identical cream+blue as the public brand field |
| Auth parity | They have forgot-password + Google/Apple on web login — track as web backlog (not only SIWA on iOS) |

### C.5 What *not* to copy

1. Headline formula “The chore app for families tired of reminding” — parent-guilt adjacent; conflicts with our positive frame.
2. English “Hero” naming and “heroes” as household unit language.
3. Generic blue + cream family-SaaS palette as the entire brand.
4. Marketing that never shows the joyful kid surface.
5. Feature laundry lists (AI, Alexa) as the hero story — we win on trust, tone, and NL family fit first.
6. Their brand split (calm site / cartoon app) — our kinship rule forbids it.
7. **Subscription pricing tables and “Start 14-day trial” as the primary CTA** — Wispel is free; donations are optional gratitude.

### C.6 Recommended Wispel wedge (use in Phase 0 one-pager)

> **Wispel** is the free, privacy-first Dutch family app where kids *want* to finish huiswerk and klusjes — warm, playful, age-aware — while parents keep calm control. Not another English chore chart with a hero sticker and a monthly bill.

Proof points to emphasise on `wispel.cc`:
1. **Gratis voor gezinnen** — optional donations only; never a child-facing paywall  
2. **Privacy first** — EU, no ads, no child tracking; plain language  
3. Positive-only motivation (no deductions, no sibling ranking)  
4. Homework + chores as one game  
5. Real kid celebration (confetti/haptics) *shown* on the marketing surface  
6. Age modes (4–7 / 8–12 / teen)  

### C.7 Plan score vs ChoreHero readiness

| Area | Score | Note |
| --- | --- | --- |
| Name escape from “Hero” lane | Strong — if Phase 0 kills “Held” too | Wispel rename is strategic, not cosmetic |
| Domain split www/app/api | Aligned | Match their pattern; fine |
| Brand foundation | Strong in plan | Must avoid cream+blue twin |
| Marketing completeness | Was weak → amended above | Need their *depth*, not their *voice* or *pricing* |
| Product emotional loops (iOS) | Strong in plan | Our actual differentiator if shipped |
| Monetization story on site | **Locked free + donations** | Contrast their trial/$6.99; make “gratis” unmistakable |
| Privacy story on site | Must be first-class | Stronger trust wedge than feature parity |

**Bottom line:** Keep the phase order. Tighten Phase 0 vocabulary away from Hero/Held. Expand Phase 4 to acquisition parity **without** copying subscription conversion. Lead with **privacy first** and **gratis + steun**. Use ChoreHero as a checklist for *what a serious family-chore marketing site contains*, and as a foil for *what Wispel must never sound, look, or charge like*.
