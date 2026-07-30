# Wispel Design System

**Wispel** (`wispel.cc`) is a Dutch gamification app that turns kids' homework and household chores into a positive, points-based game. Parents configure tasks and rewards; kids check tasks off, earn points, build streaks, and redeem rewards from a shop. Core principle: **the app never punishes — it only celebrates what went well** (no red X's, no point deductions, no leaderboards that rank a child last).

**Brand foundation:** [`docs/brand/wispel-brand-v1.md`](../docs/brand/wispel-brand-v1.md). Tokens here mirror `apps/web/app/globals.css` (shipping). Mark assets live in `brand/`.

**Two surfaces today:**
- **iOS app (SwiftUI)** — kid-facing: "Mijn Dag", "Winkel", "Mijn Ster". Age modes 4–7 / 8–12 / 13+.
- **Parent web dashboard (Next.js)** — calm: Vandaag, Goedkeuren, Taken, Winkel, Inzichten.

## Sources

- Canon: `docs/brand/wispel-brand-v1.md`, `docs/wispel-rebrand-and-ui-plan.md`, `apps/web/app/globals.css`, iOS `THPalettes`
- GitHub: [SolarnodeCC/Taakhelden](https://github.com/SolarnodeCC/Taakhelden)

## Content fundamentals

- **Language**: Dutch first, English second. Code/commits English; user-facing Dutch.
- **Voice to the child**: second person, warm, never guilt language (§3.7).
- **Voice to the parent**: plain, calm, reassuring.
- **Emoji**: OK in kid copy / task-avatar content. **Parent chrome uses SVG icons** (`NavIcon`), not emoji.
- **Notifications**: max 2/day to a child, never after bedtime, never loss-framed.

## Visual foundations

- **Two registers, one token set.** Parent = flat neutral + teal accent. Kid = coral/turquoise/yellow on cream. Teen = navy/mint.
- **Color**: shipping brand v1 — parent accent `#0e9f8e` = kid turquoise (kinship). Reject cream+#blue ChoreHero twin.
- **Type**: dashboard `system-ui`; marketing **Outfit** (`--font-display`); kid web **Fredoka** (SF Rounded stand-in).
- **Mark**: Ster + wisp in `brand/mark.svg` with word “Wispel”.
- **Chrome icons:** stroke SVG nav set in the web app. Avatars may stay emoji until commissioned art (O12).
- **Mascot:** postponed (O7).

## Index

- `styles.css` — import entry.
- `tokens/` — colors, typography, spacing, effects.
- `brand/` — `mark.svg`, `icon.svg`.
- `fonts/fonts.css` — Fredoka.
- `guidelines/` — specimen cards (incl. wordmark).
- `components/` — core + kids primitives (JSX kits).
- `ui_kits/` — parent-dashboard + kid-app click-throughs.
- `SKILL.md` — agent entry point.
