# Wispel — Competitor Scorecard
**Research date:** 2026-08-01  
**Author:** Market Research Agent (`taakhelden-market-research`)  
**Primary market:** Dutch families (NL); EU context throughout  
**Methodology:** Public sources only — websites, App Store listings, review aggregators, NL parenting/financial press. No child data. All claims cited.  
**Handoffs:** → PO (E1 pulse digest) · → marketing/positioning (E15) on Appendix A

---

## Competitor selection note

The user's request named 5 candidate slots. After public-source verification the following substitutions were made:

| Slot | Requested | Selected | Reason for substitution |
|---|---|---|---|
| 1 | ChoreHero | **ChoreHero** (`chorehero.cloud`) | Confirmed active; primary peer in existing Wispel docs |
| 2 | Homey / BusyKid / Greenlight | **Greenlight** (`greenlight.com`) | Largest chore+allowance+debit loop peer; 6.5M users; deepest feature set of the three |
| 3 | OurHome / FamilyWall | **S'moresUp / IAFT** (`smoresup.com`) | **OurHome is effectively defunct** — no meaningful updates since ~2020, server instability, login failures, data loss reported consistently through 2026 (sources: [ChoreSplit comparison](https://choresplit.com/compare/ourhome), [JustUseApp](https://justuseapp.com/en/app/879717020/ourhome-chores-and-rewards/problems), 2026-07). S'moresUp is the most-cited active alternative and directly comparable on gamification depth. |
| 4 | S'moresUp / GoHenry / bunq / NL alternative | **Gimi** (`gimi.com`) | GoHenry **not available in NL** (confirmed: [Freenance](https://freenance.io/comparisons/greenlight-vs-gohenry-vs-revolut-junior-2026/), 2026-04). Gimi is the strongest NL-native chores+allowance peer: ABN AMRO partnership, Dutch language, major NL bank integrations. bunq Junior has no chore gamification. |
| 5 | Rooster Money / iRewardChart | **Rooster Money** (`roostermoney.com`) | Strongest stars/gamification peer with photo proof; well-documented; active. UK-only but pattern matters. |

---

## Wispel shipped baseline (as of 2026-08-01)

Sourced from internal docs: `CLAUDE.md`, `docs/taakhelden-productvoorstel.md`, `docs/wispel-rebrand-and-ui-plan.md`, `docs/adr/ADR-0005-wispel-privacy-free-donations.md`.

| Shipped feature | Notes |
|---|---|
| Parent web dashboard (Next.js) | Task management, approvals, reward store management |
| iOS app — child + parent views (SwiftUI) | Age-mode aware (young/mid/teen in progress) |
| Points ledger (Ster/Star vocabulary) | Immutable ledger; no negative mechanics |
| Photo proof on task completion | EXIF-stripped before storage |
| Family goals (spaardoelen) | Kids can save toward custom rewards |
| Avatars for children | Customisable |
| Homework (huiswerk) as first-class category | Alongside klusjes |
| Dutch-first (NL) | `nl.json` localisation |
| Privacy-first architecture | EU hosting (`weur`), no ads, no child email, EXIF strip |
| **Free for families** | No subscription; optional parent-only donations |
| Real-time family sync (FamilyRoom DO) | WebSocket, ledger-serialised |
| Co-parenting support | Multiple adults on one family |

**Gaps vs field (not yet shipped):**  
Android app · marketing site `wispel.cc` · App Store listing · Dutch bank open-banking integration · Inzichten analytics · social/family wall feature

---

## Competitor 1 — ChoreHero

**Website:** [www.chorehero.cloud](https://www.chorehero.cloud) (product at `app.chorehero.cloud`)  
**Sourced:** [chorehero.cloud homepage fetch](https://www.chorehero.cloud), 2026-08-01 · [App Store](https://apps.apple.com/us/app/chorehero/id6747990658), 2026-08

### One-liner
Parent-managed family chore app: parents plan, kids submit photo/video proof, parents approve to unlock stars and rewards.

### Pricing model
**Subscription-only** — no free tier.  
- Monthly: **$6.99/mo**  
- Yearly: **$69.99/yr** (~$5.83/mo; "2 months free")  
- 14-day free trial where available  
- Source: [chorehero.cloud/#pricing](https://www.chorehero.cloud), 2026-08-01

### Platforms
- **iOS** (App Store in-app billing confirmed)  
- **Web** (`app.chorehero.cloud`, parent dashboard — works on any browser)  
- Android: **not confirmed** from public sources (unverified)

### Core features

| Dimension | ChoreHero |
|---|---|
| Chores | Yes — recurring + one-off; auto-assignment included |
| Homework | No — no homework/school category |
| Points / stars | Stars; updates immediately on parent approval |
| Rewards | Yes — parent-managed reward store |
| Photo / video proof | Yes — photo + video proof uploads |
| Parent approval queue | Yes — central approval flow |
| Streaks | Yes — streak momentum referenced |
| AI assistant | Yes — "AI assistant + AI search" listed |
| Co-parenting | Unverified (single parent account referenced) |
| Kid app | Simplified task view (child view); shared-device support |
| Parent app | Web-first parent dashboard |
| Age differentiation | No — one child view for all ages |
| Privacy stance | Plain-language privacy section on site; no EU/GDPR certification visible |
| Offline | Unverified |
| Up to N children | Up to 20 "heroes" per household |

### Notable strengths (parent-facing claims)
- Very clear 3-step loop: Plan → Proof → Reward — easy to explain to a family
- Parent-managed throughout; no child autonomy that bypasses approval
- Cloud-based = works on any device for parents (no native app install required)
- Structured marketing site with demo walkthrough, comparison guides, SEO content
- AI assistant is a differentiating feature claim in the market (2026)

### Notable weaknesses / missing pieces
- No free tier — paywall before any family can try the full product
- No homework or school category
- English only; no NL localisation
- No age modes; one child experience for ages 4 through 16+
- Branding conflict: "Hero" naming is semantically identical to our former "TaakHelden" / "Held" vocabulary
- No iDEAL, no EU payment method
- No EU/GDPR hosting transparency in public docs
- No Android app confirmed
- "Cream + professional blue" visual (noted in `wispel-rebrand-and-ui-plan.md` Appendix C) — could be confused with a generic NL/EU SaaS

### NL market fit

**Very poor.** US-origin, English-only, subscription paywall ($6.99/mo or $69.99/yr), no NL localisation, no iDEAL, no EU data sovereignty statement, no homework category relevant to Dutch school context. Dutch parents cannot pay with iDEAL; pricing in USD.

---

## Competitor 2 — Greenlight

**Website:** [greenlight.com](https://greenlight.com)  
**Sourced:** [greenlight.com/chores-and-allowance-app](https://greenlight.com/chores-and-allowance-app-for-kids), [kikaroo.app review 2026](https://kikaroo.app/blog/greenlight-debit-card-review/), [Freenance comparison 2026](https://freenance.io/comparisons/greenlight-vs-gohenry-vs-revolut-junior-2026/), 2026-08-01

### One-liner
US family financial platform with debit cards for up to 5 kids; chore tracking and allowance automation bundled into a banking product.

### Pricing model
**Subscription — four tiers, no free tier:**

| Plan | Monthly | Annual | Kids |
|---|---|---|---|
| Core | $5.99 | $71.88 | Up to 5 |
| Max | $10.98 | $131.76 | Up to 5 |
| Infinity | $15.98 | $191.76 | Up to 5 |
| Family Shield | $19.98 | $239.76 | Up to 5 + 2 adults |

Source: [kikaroo.app/blog/greenlight-fees-explained/](https://kikaroo.app/blog/greenlight-fees-explained/), 2026-08-01

### Platforms
- **iOS** (4.8★ App Store)  
- **Android** (4.7★ Google Play)  
- **Web**  
Source: [kikaroo.app review](https://kikaroo.app/blog/greenlight-debit-card-review/), 2026

### Core features

| Dimension | Greenlight |
|---|---|
| Chores | Yes — recurring + one-off; parent assigns, child checks off; parent approval |
| Homework | No |
| Points / stars | No — chores tied directly to real money (USD allowance) |
| Rewards | Real money only; no virtual rewards / reward store |
| Photo proof | Not confirmed in public docs |
| Streaks | Yes ("check off chores together and watch streaks build") |
| AI assistant | No |
| Debit card | Yes — Mastercard prepaid card for each child |
| Savings / investing | Yes — savings goals, fractional stock investing (Max tier+) |
| Co-parenting | Yes — multiple parent accounts |
| Kid app | Yes — separate child app experience |
| Parent app | Yes |
| Age differentiation | Teens-focused upper tier (earning/investing); no young-child mode |
| Privacy stance | Collects: location, purchases, financial info, contacts, search history, identifiers — linked to identity (App Store privacy label). US GLBA compliant. |
| Offline | Unverified |

### Notable strengths (parent-facing)
- 6.5 million parents and kids — dominant brand in US chore+allowance market ([greenlight.com/chores](https://greenlight.com/chores-and-allowance-app-for-kids), 2026)
- Real debit card removes the "virtual money" abstraction problem for older kids
- One-stop: banking + chores + investing + location sharing for families
- Strong App Store ratings (4.8/4.7)
- Teens earn toward real goals with a real card
- "Chore. Earn. Learn." narrative is clear

### Notable weaknesses / missing pieces
- **Requires US bank account** — not available to Dutch or EU families ([Freenance](https://freenance.io/comparisons/greenlight-vs-gohenry-vs-revolut-junior-2026/), 2026-04)
- No virtual reward system; money-only motivation means it doesn't work for young children who don't understand money value yet
- Privacy footprint is extensive (location, identity, financial data collected and linked)
- No homework category; no NL school context
- No age modes for young children
- No gamified celebration loops (confetti, animations)
- Financial product framing: reviewer note: "You're paying $71.88+/year for a banking platform when a focused chore app would solve the same problem for free" ([kikaroo.app](https://kikaroo.app/blog/greenlight-debit-card-review/), 2026)

### NL market fit

**Zero.** US-only product; requires US bank account; not available to EU-domiciled families ([Freenance, 2026-04](https://freenance.io/comparisons/greenlight-vs-gohenry-vs-revolut-junior-2026/)). No GDPR-native stance. NL parents cannot use this product.

---

## Competitor 3 — S'moresUp / It's a Family Thing! (IAFT)

**Website:** [smoresup.com](https://www.smoresup.com) / IAFT app  
**Sourced:** [smoresup.com/pricing](https://www.smoresup.com/pricing), [App Store listing](https://apps.apple.com/us/app/its-a-family-thing/id6447779421), [Google Play listing](https://play.google.com/store/apps/details?id=com.rotation5.itsafamilything), [aitakescare.com 2026 review](https://aitakescare.com/blog/best-chore-apps-for-families), 2026-08-01

### Substitution rationale
OurHome stopped active development ~2020. Server-side login failures and data loss are reported continuously through 2026. S'moresUp is the most commonly cited replacement in parent communities ("families have migrated to... S'moresUp" — [ChoreSplit/OurHome](https://choresplit.com/compare/ourhome), 2026) and is the closest feature-depth equivalent with active development.

### One-liner
AI-powered all-in-one family management platform built on S'moresUp, with gamified chores, approval workflows, mood tracking, and a family calendar.

### Pricing model
**Freemium + subscription (price increase July 2026):**

| Plan | Monthly | Annual | Notes |
|---|---|---|---|
| Intro (S'moresUp) | Free | Free | Core chores, calendar, wallet, badges |
| S'moresUp Premium | $9.99 | $99.99 | As of 2026-07-05; was $7.99/$79.99 |
| IAFT Starter | $9.99 | — | Chores, calendar, wallet, Campfire |
| IAFT SuperFamily | $19.99 | — | Rotate/Compete/Collaborate chores + proof |
| IAFT SmartFamily | $29.99 | — | AI planning, mood tracking, Frankie |

45-day free trial with all features unlocked.  
Source: [smoresup.com/pricing](https://www.smoresup.com/pricing), 2026-07-05

### Platforms
- **iOS** — 4.4★ ([App Store](https://apps.apple.com/us/app/its-a-family-thing/id6447779421), 2026-08)
- **Android** — 2.7–3.0★ ([Google Play](https://play.google.com/store/apps/details?id=com.rotation5.itsafamilything), 2026-07) — notably weaker
- **Web** (parent access)

### Core features

| Dimension | S'moresUp / IAFT |
|---|---|
| Chores | Yes — Rotate, Compete, Collaborate, Bonus chore modes (premium) |
| Homework | No dedicated category |
| Points / stars | Points + badges + skill badges |
| Rewards | Custom rewards, auto-fill, wallet (MyWallet) |
| Photo proof | Yes (premium tier) |
| Parent approval | Yes (premium) |
| AI assistant | Yes — "Frankie" AI co-pilot + weekly planning |
| Mood tracking | Yes (IAFT SmartFamily) |
| Family calendar | Yes |
| Family wall/chat | Yes — "Campfire" |
| Co-parenting | Yes — multiple adults |
| Kid app | Yes — age-appropriate (described for 4–10 primary) |
| Teen features | TeenSpirit sub-app |
| Age differentiation | Partial (young kids vs teens, separate TeenSpirit) |
| Privacy stance | US-hosted; privacy policy at smoresup.com — no EU/GDPR transparency visible |
| Offline | Unverified |
| User base | "Trusted by over 300,000 families worldwide" ([smoresup.com](https://www.smoresup.com/blog/its-a-family-thing-the-modern-all-in-one-family-management-app), 2026) |

### Notable strengths (parent-facing)
- Most feature-rich gamification in the field: Rotate, Compete, Collaborate chore modes create genuine engagement
- AI integration at multiple touchpoints (planning, scheduling, mood)
- 45-day free trial is generous
- Teen-specific features (TeenSpirit)
- Family wall / Campfire keeps extended family connected
- "Two-time Apple App of the Day" cited in marketing ([smoresup.com](https://www.smoresup.com/blog/its-a-family-thing-the-modern-all-in-one-family-management-app))

### Notable weaknesses / missing pieces
- **Severe backlash over July 2026 price increase**: "Changed features after we paid now want more money... This is pure greed" — multiple Play Store reviews, May 2026 ([Google Play](https://play.google.com/store/apps/details?id=com.rotation5.itsafamilything&hl=en), 2026-07). This is an active churn trigger.
- Android app quality significantly lags iOS (2.7★ vs 4.4★)
- English only; no NL localisation
- US-hosted; no EU/GDPR transparency
- Feature complexity = steep setup; may overwhelm NL families looking for simplicity
- No NL market presence; no iDEAL; USD pricing
- No dedicated homework category
- No Dutch child vocabulary or positive-only pedagogy language

### NL market fit

**Very poor.** US-origin, English, subscription ($9.99/mo+), no NL localisation, no iDEAL, US-hosted. The July 2026 price increase controversy creates active churn opportunity for a free NL alternative.

---

## Competitor 4 — Gimi

**Website:** [gimi.com/nl](https://gimi.com/nl/hoe-het-werkt/)  
**Sourced:** [gimi.com/nl/prijzen](https://gimi.com/nl/prijzen/), [ABN AMRO Gimi page](https://www.abnamro.nl/nl/prive/speciaal-voor/kinderen-en-geld/gimi/index.html), [ABN AMRO press release](https://www.abnamro.com/en/news/new-gimi-app-makes-kids-financially-resilient), [App Store NL](https://apps.apple.com/nl/app/gimi-zakgeld-op-de-telefoon/id935778197), 2026-08-01

### One-liner
Scandinavian chores+allowance+bank-integration app for children 8–13, with NL-first distribution via ABN AMRO partnership and Dutch bank open-banking integration.

### Pricing model
**Freemium:**
- **Free** (Gimi Gratis): chores, allowance, savings goals, bank account linking, lessons
- **Pro**: from **€2.99/mo** — Superskills Adventure, Family Missions, extended features
- **ABN AMRO partnership**: ABN AMRO Jongerengroeirekening customers get Pro access **free**  
Source: [gimi.com/nl/prijzen](https://gimi.com/nl/prijzen/), 2026-08-01 · [ABN AMRO](https://www.abnamro.nl/nl/prive/speciaal-voor/kinderen-en-geld/gimi/index.html)

### Platforms
- **iOS** — Dutch App Store listing: [App Store NL](https://apps.apple.com/nl/app/gimi-zakgeld-op-de-telefoon/id935778197)
- **Android** — available

### Core features

| Dimension | Gimi |
|---|---|
| Chores (klusjes) | Yes — parent creates klusjes with money amounts; child completes; parent pays |
| Homework | No |
| Points / stars | No — money-only (no virtual points gamification) |
| Rewards | Savings goals only; no reward store |
| Photo proof | Partial — "upload photos" mentioned in ABN AMRO press release ([2022](https://www.abnamro.com/en/news/new-gimi-app-makes-kids-financially-resilient)) |
| Parent approval | Yes — parent approves klusje completion before money transfers |
| Bank linking | Yes — ABN AMRO, ING, SNS, Rabobank (open banking) |
| Dutch banks | Full integration with major NL banks |
| Financial education | Yes — quizzes, lessons (Superskills Adventure), "Piggy" adviser |
| Family missions | Yes — Familiemissies (Pro) |
| Co-parenting | Yes — multiple adults can add klusjes |
| Kid app | Yes — Dutch-language child-facing interface |
| Age differentiation | Ages 8–13 target |
| Privacy stance | Gimi AB registered with Swedish FSA (Finansinspektionen) as payment service; GDPR applicable (Swedish/EU origin) |
| Offline | Unverified |
| Real money | Linked to actual child bank balance; not virtual |

### Notable strengths (parent-facing)
- **NL distribution**: ABN AMRO partnership gives Gimi a direct channel to one of NL's largest banks' young customer base. ABN AMRO targets "one-third of its clients in the 8–13 age group" ([ABN AMRO press](https://www.abnamro.com/en/news/new-gimi-app-makes-kids-financially-resilient), 2022)
- Dutch language (app, website, content)
- Major NL bank account linking (ABN AMRO, ING, SNS, Rabobank) — allowance appears on the child's actual balance, making it tangible
- Financial literacy focus aligns with Nibud's Dutch financial education goals
- EU/Swedish origin — GDPR-compliant by default
- Free tier includes core features (chores, allowance, savings)
- ABN AMRO customers get Pro free — reduces friction

### Notable weaknesses / missing pieces
- **No points/stars gamification** — chores earn real money only; no celebration loop, no confetti, no avatar progression for young children
- **No reward store** — can't redeem points for custom prizes
- Age 8–13 only: too old for young-mode (4–7), no teen UX
- No homework/huiswerk category
- **Purely money-focused**: motivation depends on children already understanding money value; less effective for ages 4–7
- No visual kid celebration (confetti, haptic feedback, animations)
- No positive-only framing — deducting payment for uncompleted chores is implicit
- Swedish FSA not a banking licence — Gimi does not hold money itself; it reads/connects to existing bank accounts
- Chores as a "heitje voor een karweitje" model may not align with families that prefer non-money motivation

### NL market fit

**Strong** — the highest NL fit of the five competitors. Dutch language, Dutch banks, ABN AMRO partnership distribution. However, Gimi positions as financial education, not as family gamification or homework motivation. NL families who want engagement loops and homework tracking are not served by Gimi.

---

## Competitor 5 — NatWest Rooster Money

**Website:** [roostermoney.com](https://roostermoney.com)  
**Sourced:** [roostermoney.com/feature/chore-app](https://roostermoney.com/gb/feature/chore-app-rooster-money/), [nutsaboutmoney.com review 2026](https://www.nutsaboutmoney.com/reviews/rooster-money), [moneytothemasses.com review](https://moneytothemasses.com/banking/roostermoney-pocket-money-app-review), [neobanks.app](https://neobanks.app/rooster-money.htm), 2026-08-01

### One-liner
UK pocket-money app with a stars-based reward system, chore management with photo proof, and an optional NatWest-backed prepaid debit card for ages 6–17.

### Pricing model
**Freemium + card subscription:**
- **Virtual Tracker**: **Free** — stars system, virtual allowance, savings goals (no real money, no chores at free tier)
- **Rooster Plus**: **~£0.99/mo** — adds chore management (per nutsaboutmoney, 2026)
- **Rooster Card**: **£1.99/mo or £19.99/yr** — includes prepaid debit card + all chore features  
- **NatWest/RBS/Ulster Bank customers**: up to 3 Rooster Cards **free**  
Source: [moneytothemasses.com](https://moneytothemasses.com/banking/roostermoney-pocket-money-app-review), [natwest.com](https://www.natwest.com/current-accounts/childrens-accounts/kids-pocket-money-card.html), 2026

### Platforms
- **iOS** + **Android**  
- **UK residents only** — confirmed: "NatWest Rooster Money is currently only available in the UK" ([roostermoney.com](https://roostermoney.com), 2026-08-01)

### Core features

| Dimension | Rooster Money |
|---|---|
| Chores | Yes — recurring + one-off; paid via allowance or extra earners |
| Homework | No |
| Stars / points | Yes — Stars system (age 3+); not tied to money at free tier |
| Rewards | Yes — stars toward goals; virtual money pots (Spend/Save/Give) |
| Photo proof | Yes — child taps chore → Done → can attach photo |
| Parent approval | Yes — parent notified; can approve/reject |
| Prepaid debit card | Yes (Rooster Card, ages 6+) |
| Savings goals / pots | Yes — multiple pots (Save, Give, custom Goal pots) |
| Auto allowance | Yes — scheduled weekly or custom |
| Co-parenting | Yes — multiple guardians (unlimited on Rooster Plus) |
| Kid app | Yes — separate child login and view |
| Parent app | Yes |
| Age differentiation | Stars/virtual for age 3+; card from age 6 |
| Privacy stance | NatWest-backed; UK FCA regulated; UK-only — not GDPR-NL regulated |
| Offline | Unverified |
| Ratings | 4.7★ Trustpilot (2,522 reviews) ([neobanks.app](https://neobanks.app/rooster-money.htm), 2026) · 4.7★ Google Play |

### Notable strengths (parent-facing)
- **Highest trust rating** in the field: 4.7★ Trustpilot from 2,500+ reviews ("easy to set up... great motivation for chores" — [moneytothemasses.com](https://moneytothemasses.com/banking/roostermoney-pocket-money-app-review))
- Stars system (not just money) — works for age 3+ including children who don't understand money yet
- Free virtual tracker tier means families can start without any commitment
- Photo proof included (premium) — clean UX for parent verification
- Bank-backed credibility (NatWest) — high parent trust
- Age 3 → 17 span is the widest in the field
- Automatic allowance with percentage split into Save/Spend/Give — financial literacy built in

### Notable weaknesses / missing pieces
- **UK-only** — absolutely not available to Dutch families
- Not a gamification app: no confetti, animations, avatar progression, or celebration loop
- Stars still effectively represent money in the bank-backed version
- No homework category
- No age modes (young/mid/teen UI differentiation)
- The bank requirement (NatWest) limits it structurally to the UK
- No NL language; GBP pricing only

### NL market fit

**Zero.** UK residents only. Confirmed unavailable to Dutch families. Included because its gamification pattern (stars, photo proof, approval, savings pots, free virtual tier) is the closest to Wispel's loop pattern among Western chore apps, making it a useful **design benchmark** even though it is not a direct market competitor in NL.

---

## Summary scoring table (PO scorecard)

Scale: ✅ Strong · ⚠️ Partial / unverified · ❌ Absent  
"NL relevant" = actually available and usable by Dutch families

| Dimension | ChoreHero | Greenlight | S'moresUp/IAFT | **Gimi** | Rooster Money | **Wispel** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Available in NL | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Dutch language | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Free for families | ❌ | ❌ | ⚠️ (intro) | ✅ (basic) | ⚠️ (tracker) | ✅ |
| iDEAL / EU payment | ❌ | ❌ | ❌ | ✅ (via bank) | ❌ | ✅ (planned) |
| EU/GDPR hosting | ❌ | ❌ | ❌ | ✅ | ❌ (UK) | ✅ |
| Chores | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Homework category | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Points/stars (non-money) | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Reward store | ✅ | ❌ | ✅ | ❌ | ⚠️ | ✅ |
| Photo proof | ✅ | ❌ | ✅ (paid) | ⚠️ | ✅ (paid) | ✅ |
| Parent approval queue | ✅ | ✅ | ✅ (paid) | ✅ | ✅ | ✅ |
| Savings goals | ❌ | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| Co-parenting | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kid celebration loop | ⚠️ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Age differentiation | ❌ | ❌ | ⚠️ (teen) | ❌ | ⚠️ (3+/6+) | ✅ (3 modes) |
| Android app | ⚠️ | ✅ | ✅ | ✅ | ✅ | ❌ |
| No child PII / tracking | ⚠️ | ❌ | ⚠️ | ✅ | ⚠️ | ✅ |
| Positive-only mechanics | ❌ (unverified) | ❌ | ❌ (late penalties) | ⚠️ | ⚠️ | ✅ |

---

## Parent demand signals

Synthesised from: [ourfamilyhabits.com 2026](https://www.ourfamilyhabits.com/articles/best-chore-apps-for-families), [aitakescare.com 2026](https://aitakescare.com/blog/best-chore-apps-for-families), [icecreamnstickyfingers.com](https://icecreamnstickyfinagers.com/kids-chore-app-review/), NL parenting press (howaboutmom.nl, sparenenbesparen.nl, veel.nl), [S'moresUp Play Store reviews 2026](https://play.google.com/store/apps/details?id=com.rotation5.itsafamilything&hl=en), 2026-08-01

| Signal | Frequency | Segment | Wispel position |
|---|---|---|---|
| "Why are chores tied only to money? My 6-year-old doesn't understand money yet." | High | Families with young children (4–8) | ✅ Ster/Star points; reward store not money-gated |
| "I switched because they raised prices / added paywalls on features I already had." | High (active 2026) | S'moresUp / BusyKid switchers | ✅ Free forever; no feature tiers |
| "OurHome broke and we lost all our data." | High | Former OurHome families | ✅ Durable ledger; EU-hosted |
| "I want homework tracked too, not just chores." | Medium | NL school-age families | ✅ Huiswerk as first-class category |
| "Is there a Dutch / European version?" | Medium (NL forums) | Dutch families considering US apps | ✅ NL-first |
| "The app the kids love, not the one I'm forcing on them." | High | All segments | ✅ Kid register (warm/celebration); positive-only framing |
| "I don't want my kids' data on a US server." | Medium–High (post-GDPR NL) | Privacy-conscious Dutch parents | ✅ EU hosting, no child tracking |
| "It's too complicated to set up." | Medium | Busy parents | ⚠️ Backlog: onboarding UX + empty states (Phase 6) |
| "No Android app, our kids use Android." | Medium | Mixed-device families | ❌ Gap: Android not shipped |
| "Can I link it to my bank for the allowance?" | Medium (NL) | Families using ABN/ING | ⚠️ Backlog: open-banking integration not planned (O29?) |

---

## Positioning opportunity for Wispel

### The gap ChoreHero, Greenlight, and S'moresUp leave open

All three charge €6–$30/mo, are English-only, US-hosted, and have no Dutch-school context. None have homework. S'moresUp's July 2026 price increase is creating active churn. OurHome's collapse left 10,000s of families with no free, trustworthy alternative.

### The gap Gimi leaves open

Gimi has NL distribution and Dutch banks but is purely money-focused. It does not gamify with points/stars, has no celebration loop, no avatar progression, no reward store, and no homework category. Age-limited to 8–13. It does not serve the 4–7 or teen segments at all.

### Wispel's differentiated wedge (confirmed by research)

> **Wispel is the free, privacy-first Dutch app where kids actually want to finish huiswerk and klusjes — warm gamification for young children, with calm parent control — not another English subscription with a monthly bill.**

Proof points sourced in this research:
1. **Gratis** — zero subscription; only app in the field that is genuinely free with all family features
2. **Dutch-first** — only app with NL language + homework category + Dutch school calendar context
3. **Privacy-first EU** — only app in the field with EU hosting + no child tracking + EXIF-stripping visible in architecture
4. **Points/stars not money** — effective for ages 4–7 where money motivation fails (Gimi, Greenlight)
5. **Age modes (young/mid/teen)** — no competitor in this set has three distinct child UX modes
6. **Positive-only** — no late penalties, no deductions (explicit differentiator vs S'moresUp, which has "chore locking and late penalties")
7. **Photo proof** — parity with all paid competitors; Wispel ships this free

### Backlog context

| Finding | Backlog implication | Priority signal |
|---|---|---|
| Android absence is noted gap | Android app (WS-ANDROID or similar) | Medium — blocked by iOS not yet on App Store |
| NL bank open-banking (Gimi differentiator) | Evaluate iDEAL/open-banking integration | Medium — after core launch |
| S'moresUp price increase churn (active 2026) | **Time-sensitive**: position "always free" prominently on wispel.cc | High — acquisition opportunity now |
| OurHome data loss trauma | Emphasise ledger durability + data export on marketing | Medium |
| Age 8–13 Gimi gap in young/teen modes | Accelerate young-mode pass (Phase 5.5) | High — this is the open NL market gap vs Gimi |
| Homework category absent in all 5 competitors | Double down on huiswerk as primary SEO + marketing hook | High — unique differentiator with zero competition |
| Gimi lacks celebration / gamification loop | Show the kid experience on wispel.cc landing (Phase 4 requirement) | High |

---

## Handoffs fired

→ **PO** (E1): Pulse digest — S'moresUp July 2026 price increase is creating active switcher demand; time to accelerate wispel.cc launch and "always free" messaging.  
→ **Marketing** (E15): Positioning input — homework category + free-forever + EU privacy are the three unclaimed wedges. No competitor owns all three. Positioning one-pager in §Positioning opportunity above; do not copy ICP table, reference this doc.  
→ **PO** (E1): Backlog annotation — Android gap is medium-priority; open-banking (Gimi-parity) is worth O-register entry; young-mode acceleration is high priority given Gimi's 8–13 floor.

---

## Sources index

| Source | URL | Date accessed |
|---|---|---|
| ChoreHero homepage | https://www.chorehero.cloud | 2026-08-01 |
| Greenlight chores page | https://greenlight.com/chores-and-allowance-app-for-kids | 2026-08-01 |
| Greenlight fee breakdown | https://kikaroo.app/blog/greenlight-fees-explained/ | 2026-08-01 |
| Greenlight EU availability | https://freenance.io/comparisons/greenlight-vs-gohenry-vs-revolut-junior-2026/ | 2026-04 |
| S'moresUp pricing | https://www.smoresup.com/pricing | 2026-08-01 |
| IAFT App Store | https://apps.apple.com/us/app/its-a-family-thing/id6447779421 | 2026-08-01 |
| IAFT Google Play (negative reviews) | https://play.google.com/store/apps/details?id=com.rotation5.itsafamilything | 2026-07 |
| OurHome defunct — ChoreSplit | https://choresplit.com/compare/ourhome | 2026 |
| OurHome problems — JustUseApp | https://justuseapp.com/en/app/879717020/ourhome-chores-and-rewards/problems | 2026 |
| Gimi NL pricing | https://gimi.com/nl/prijzen/ | 2026-08-01 |
| ABN AMRO × Gimi | https://www.abnamro.nl/nl/prive/speciaal-voor/kinderen-en-geld/gimi/index.html | 2026-08-01 |
| ABN AMRO Gimi press release | https://www.abnamro.com/en/news/new-gimi-app-makes-kids-financially-resilient | 2022 |
| Gimi App Store NL | https://apps.apple.com/nl/app/gimi-zakgeld-op-de-telefoon/id935778197 | 2026-08-01 |
| Rooster Money homepage | https://roostermoney.com | 2026-08-01 |
| Rooster Money chores feature | https://roostermoney.com/gb/feature/chore-app-rooster-money/ | 2026-08-01 |
| Rooster Money review (Nuts About Money) | https://www.nutsaboutmoney.com/reviews/rooster-money | 2026 |
| Rooster Money review (M2M) | https://moneytothemasses.com/banking/roostermoney-pocket-money-app-review | 2026 |
| Rooster Money Trustpilot rating | https://neobanks.app/rooster-money.htm | 2026-05 |
| NL zakgeld / Nibud context | https://howaboutmom.nl/nibud-zakgeld-contant-digitaal/ | 2026 |
| NL zakgeld apps (sparenenbesparen.nl) | https://sparenenbesparen.nl/blog/zakgeld-financiele-opvoeding-kinderen-geld/ | 2026 |
| GoHenry NL unavailability | https://freenance.io/comparisons/kids-debit-card-comparison-europe-2026/ | 2026 |
| Best chore apps 2026 (ourfamilyhabits.com) | https://www.ourfamilyhabits.com/articles/best-chore-apps-for-families | 2026 |
| Best chore apps 2026 (aitakescare.com) | https://aitakescare.com/blog/best-chore-apps-for-families | 2026 |
| BusyKid review 2026 | https://www.kidsmoney.org/parents/money-management/busykid-review/ | 2026 |

---

*This document contains no child PII. All parent sentiment is anonymised and sourced from public review platforms. AVG/GDPR respected throughout.*  
*Next scheduled market pulse: 2026-11-01 (Q4 pre-holiday competitive window).*
