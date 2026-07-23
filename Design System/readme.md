# TaakHelden Design System

**TaakHelden** ("task heroes") is a Dutch gamification app that turns kids' homework and household chores into a positive, points-based game. Parents configure tasks and rewards; kids check tasks off, earn points, build streaks, and redeem rewards from a shop. Core principle from the product proposal: **the app never punishes — it only celebrates what went well** (no red X's, no point deductions, no leaderboards that rank a child last).

**Two surfaces today:**
- **iOS app (SwiftUI)** — the primary kid-facing experience: "Mijn Dag" (Today), "Winkel" (Shop), "Mijn Held" (My Hero/avatar+badges). Three age modes (4–7, 8–12, 13+) shift tone and visual density.
- **Parent web dashboard (Next.js)** — calmer, business-like: Vandaag, Goedkeuren (Approvals), Taken (Tasks), Winkel (Shop), Inzichten (Insights).

## Sources

- GitHub: [SolarnodeCC/Taakhelden](https://github.com/SolarnodeCC/Taakhelden) (private) — explore further for the full API spec, architecture, and any UI work that lands after this design system was built.
- Read for this system: root `README.md`, `CLAUDE.md`, `docs/taakhelden-productvoorstel.md` (full product proposal — richest source for tone, gamification rules, UI direction), `apps/web/app/globals.css` (the only real design tokens in the codebase), `apps/web/tailwind.config.ts`, the parent dashboard's App Router pages/components, and `apps/web/messages/{nl,en}.json`.
- No Figma file was attached. No design tool export exists in the repo.

**Important caveat: the product is pre-visual-design.** The codebase's own `globals.css` comment says the palette is a *"placeholder pending design"*. There is no logo, no icon set, no illustration library, and no built iOS app UI (the SwiftUI project is scaffolded but empty — `apps/ios/README.md` only). This design system is therefore a **reasonable first visual direction inferred from the real tokens that do exist plus the product proposal's explicit style directions** (§4 UI-ontwerp) — not a copy of an established brand. Treat it as a strong starting point to react to, not ground truth to preserve at all costs.

## Content fundamentals

- **Language**: Dutch first (`nl` default locale), English second (`en`). All code/commits are English; all user-facing copy is Dutch. Bilingual pairs live in `apps/web/messages/`.
- **Voice to the child**: always second person ("je"), always warm and encouraging, never guilt language. The product proposal has an explicit ❌/✅ copy table, e.g. instead of *"Je bent vergeten je kamer op te ruimen"* it's *"Je kamer wacht op je superkrachten! 💪 (+10 punten)"*; instead of *"Afgekeurd"* it's *"Bijna! Papa vraagt of je nog even naar de hoekjes wil kijken 😉"*.
- **Voice to the parent**: plain, calm, reassuring — real strings from the login form: *"Dat e-mailadres en wachtwoord passen nog niet bij elkaar. Probeer het gerust opnieuw."* and insights are framed as *"gepresenteerd als hulp voor het gesprek, nooit als surveillance-tool"* (help for the conversation, never a surveillance tool).
- **Emoji**: used deliberately in kid-facing copy and notifications as warmth/emphasis (💪🌟🏆🔥😉🧹📚), dialed back sharply in teen mode ("minder emoji"). Parent-dashboard copy uses no emoji.
- **Rules baked into tone**: max 2 notifications/day to a child, never after bedtime, never phrased as loss — always phrased as an opportunity or a reward earned.
- **Vibe**: encouraging, autonomy-respecting, non-competitive between siblings (no individual leaderboard; only optional cooperative family goals).

## Visual foundations

- **Two visual registers, one token set.** The parent dashboard is flat, neutral, business-calm (white/near-white surfaces, one teal accent, thin borders, no illustration). The kid app is warm and rounded (coral/turquoise/sunny-yellow on cream, thick rounded type, confetti/Lottie animation on completion per the product proposal) — teen mode mutes this to navy/mint with far less ornamentation.
- **Color**: real dashboard tokens from `globals.css` — white bg `#ffffff`, surface `#f6f7f9`, border `#e5e8ec`, text `#1b1f24`/muted `#5a6470`, teal accent `#0e9f8e` (hover `#0c8c7d`), danger `#b00020`, success `#1f9254`. Kid-mode and teen-mode palettes are **not** in the code — they're translated from named colors in the product proposal ("koraal, turquoise, zonnig geel op crème" / "donkerblauw/mint") into approximate hex; flagged as inferred, not sourced.
- **Type**: the dashboard uses the real system font stack from code (`system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`) — no custom webfont, matches the actual Next.js app exactly. The kid app is specified in the proposal as **SF Rounded** (Apple's system rounded face) — see the Fonts note below for the substitution used here.
- **Spacing & radius**: dashboard radius is the code's real `--radius: 0.625rem` (10px, `rounded` in Tailwind maps straight to it); kid-mode UI takes noticeably larger radii (`--radius-lg`/`--radius-xl`, 16–24px) for the "warme, ronde vormen" (warm, round shapes) the proposal calls for.
- **Backgrounds**: no photography, no gradients, no patterns/textures anywhere in the real code or the proposal. Dashboard is flat white/surface blocks; kid app is a solid cream field with rounded white/tinted cards — no full-bleed imagery exists to source.
- **Shadows**: dashboard cards use a barely-there shadow (`--shadow-sm`) over a 1px border — flat and quiet. Kid-mode task cards get a slightly warmer, softer shadow (`--shadow-kid`, coral-tinted) to feel tactile/tappable.
- **Borders**: dashboard components are bordered (1px `--color-border`) rather than shadow-only — matches the real `border-border` classes throughout `AppShell.tsx`/`LoginForm.tsx`.
- **Animation**: the code only shows `transition-colors` (150ms) on buttons/links/nav — no easing curves or motion library present. The proposal calls for a **satisfying checkmark animation + haptics/sound on task completion and confetti (Lottie) on milestones** in the kid app — not implemented anywhere yet, so treat as a documented gap rather than a built pattern.
- **Hover/press states**: real code pattern is a **darker fill on hover** for the primary button (`--color-accent` → `--color-accent-hover`) and a **subtle surface-tint hover** for secondary/ghost/nav items (`hover:bg-border/50`, `hover:bg-surface`). No press/active-state styling exists in the code (no scale/shrink) — components here keep hover-only for fidelity.
- **Transparency/blur**: none in the dashboard. The kid-app tab bar and iOS chrome in the UI kit use standard iOS translucency (system convention, not a documented brand element).
- **Corner radii**: dashboard ~6–10px (sm/default); kid-mode 16–24px, plus full-pill for badges/streak/points chips.
- **Cards**: dashboard cards = white, 1px bordered, 10–16px radius, near-flat shadow, no color accents beyond content. Kid-mode cards = white or soft-tinted, 16–24px radius, warm shadow, an icon leading each row.
- **Imagery color vibe**: no photography exists in the source to characterize (no marketing site, no photo assets in the repo).

## Iconography

- **No icon system exists in the codebase.** No icon font, no SVG sprite, no PNG icon set was found in `SolarnodeCC/Taakhelden`.
- **Emoji stand in for icons everywhere real copy specifies icons** — task categories (🧹 Huishouden, 📚 Huiswerk), notification accents (💪🌟🏆🔥), and reward/badge art in this system's components (`TaskCard`, `RewardCard`, `AvatarBadge`, `PointsBadge`, `StreakBadge` all take an `icon`/`emoji` prop, not an icon-component reference). This mirrors the product proposal directly (its own category and template lists use emoji as icon stand-ins).
- **No CDN icon set is wired in** for this first pass, since every icon-shaped surface in the real product is emoji, not glyphs — introducing e.g. Lucide would invent a pattern the source doesn't use. If the dashboard later needs UI chrome icons (chevrons, close buttons) that shouldn't be emoji, Lucide (stroke-based, rounded joins) is the recommended nearest-fit CDN set to match the brand's rounded warmth — flag before adding.
- **Avatars**: the product proposal describes a diverse **avatar library** (skin tones, hairstyles, wheelchair, glasses, gender-neutral animal/fantasy options) plus custom photos, none of which exist as assets yet. `AvatarBadge` uses a placeholder emoji until real avatar art is supplied — the "Avatar Variants" card shows girl/boy emoji stand-ins across all three age modes (`tone="kid"` for young/mid, `tone="teen"` for the muted teen palette); animal/fantasy gender-neutral options from the proposal still need art too.

## Fonts

- **Dashboard**: `system-ui` stack — taken verbatim from `apps/web/app/globals.css`, no substitution needed.
- **Kid app display**: the proposal specifies **SF Rounded**, Apple's system rounded typeface, which has no distributable web font file. **Fredoka** (Google Fonts) is substituted here as the nearest visual match (rounded terminals, comparable weight range, friendly but not cartoonish). **Flag for the team**: please supply real SF Rounded / a licensed equivalent if pixel-accurate type matching to the eventual iOS build is needed for web mockups.

## No logo

No logo or brand mark exists anywhere in the source. The wordmark card and every mockup here render "TaakHelden" as plain type in the brand accent color rather than inventing a mark. Please attach real logo files if/when they exist.

## Index

- `styles.css` — import-only entry point.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `effects.css` (shadows/transitions).
- `fonts/fonts.css` — Fredoka substitution import (flagged above).
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand groups in the Design System tab).
- `components/core/` — Button, Field + Input, Card, Badge.
- `components/feedback/` — Alert, ProgressBar.
- `components/navigation/` — SidebarNav.
- `components/kids/` — TaskCard, RewardCard, PointsBadge, StreakBadge, AvatarBadge.
- `ui_kits/parent-dashboard/` — click-through recreation: login → Vandaag/Goedkeuren/Taken/Winkel/Inzichten, built on the real `AppShell.tsx`/`nav.ts` structure and copy.
- `ui_kits/kid-app/` — click-through iOS mockup: Mijn Dag / Winkel / Mijn Held tabs.
- `SKILL.md` — Claude Code / Agent Skills-compatible entry point for this system.

### Intentional additions
No component inventory was defined by any attached source (no Figma, no existing component library — only ad-hoc Tailwind classes in JSX). All components listed above were authored from scratch, sized to what the real screens (login form, app shell, task/reward descriptions) actually need — not a generic "usually-included" set. `TaskCard`, `RewardCard`, `PointsBadge`, `StreakBadge`, and `AvatarBadge` are product-specific additions grounded directly in the product proposal's UI section (§4.1) since no such components exist in code yet.
