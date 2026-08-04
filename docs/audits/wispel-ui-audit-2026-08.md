# Wispel UI audit — augustus 2026

Critical UI/UX + accessibility review of `apps/web` (parent dashboard, auth, marketing).
Machine-readable findings: [`wispel-ui-audit-2026-08.json`](./wispel-ui-audit-2026-08.json).

**Scope.** `apps/web` only. `apps/ios` and the `Design System/` source kits were not
executed; they appear here only where their tokens are mirrored into
`apps/web/app/globals.css`.

**Method.** Static review of every `.tsx` under `apps/web/app` and `apps/web/components`
against the repo's own token/primitive rules (`CLAUDE.md`, `.claude/rules/web/ui.md`),
plus programmatic WCAG contrast computation over every token pair in `globals.css`.
No running instance or screenshots were available in this environment, so findings about
rendered geometry (touch-target height, line-height) are derived from `tailwind.config.ts`
and the applied utility classes rather than measured in a browser. Everything else is
cited to `file:line`.

---

> **Status: all 24 findings fixed** (2026-08-04). Per-finding notes live in the
> JSON under `status` / `fix`. Verification: `npm run typecheck` clean,
> `npm run lint` clean, `npm test` — 131 API + 74 web tests pass, `next build`
> succeeds, and the emitted CSS confirms paired line-heights, the base focus
> rule and the new tokens. A regression guard
> (`apps/web/lib/design-tokens.test.ts`, 18 assertions) now fails the build if
> any shipped colour pair drops below its WCAG threshold or the type scale loses
> its line-heights — confirmed to fail on a reverted accent token.
>
> These are static verifications. No browser or screen-reader pass was possible
> in this environment, so the keyboard drag path, the drawer focus behaviour and
> the rendered touch targets still warrant a manual check.

## Verdict

The architecture is sound and the semantic HTML is above the React norm. The damage is
concentrated in **three configuration values**, not in components — which is good news,
because each one is a few lines that fixes dozens of screens.

| Severity | Count |
|---|---|
| Critical | 4 |
| High | 7 |
| Medium | 10 |
| Low | 3 |
| **Total** | **24** |

---

## Measured contrast (computed, not estimated)

| Pair | Ratio | AA 4.5:1 |
|---|---|---|
| white on `--color-accent` #0e9f8e — **primary Button** | **3.30** | ❌ |
| `--color-accent` on white — **every link, active nav** | **3.30** | ❌ |
| white on `--color-accent-hover` #0c8c7d | **4.15** | ❌ |
| accent on `bg-accent/10` over white — **task badges** | **2.95** | ❌ |
| accent on `bg-accent/10` over surface | **2.76** | ❌ |
| Badge `accent` tone (#0c8c7d on #d9f2ef) | **3.53** | ❌ |
| `--color-success` on `--color-success-bg` — **success Alert** | **3.60** | ❌ |
| `text-muted/70` on white | **3.11** | ❌ |
| `--color-border` #e5e8ec vs white — **input/secondary-button boundary** | **1.23** | ❌ (needs 3:1 per 1.4.11) |
| `--color-text-muted` on white | 6.01 | ✅ |
| `--color-text-muted` on surface | 5.61 | ✅ |
| `--color-text` on white | 16.56 | ✅ |
| `--color-danger` on white / on danger-bg | 7.33 / 6.43 | ✅ |
| PointsBadge `#8a5a00` on `#fff3d6` | 5.37 | ✅ (but raw hex) |
| StreakBadge `#a13a1f` on `#ffe1da` | 5.42 | ✅ (but raw hex) |
| teen-mint / teen-muted on teen-navy | 8.50 / 5.85 | ✅ |

Candidate accent replacements (both directions, since the token is used as text *and* fill):

| Candidate | Ratio |
|---|---|
| `#0d9484` | 3.76 ❌ |
| `#0c8578` | 4.52 ✅ (marginal) |
| **`#0b7d6f`** | **5.03 ✅ (recommended)** |
| `#0a7365` | 5.75 ✅ |
| `#00695c` | 6.61 ✅ |

Reproduce: the computation script is inline in the audit history; any sRGB relative-luminance
implementation gives the same numbers.

---

## Findings

### Critical

| ID | Title | Anchor |
|---|---|---|
| UI-COLOR-001 | Brand accent fails AA at 3.30:1 — primary button, links, active nav | `globals.css:21-22`, `Button.tsx:11-12` |
| UI-A11Y-002 | Week planner rescheduling is drag-only — no keyboard path (2.1.1, **Level A**) | `WeekPlannerGrid.tsx:143` |
| UI-A11Y-003 | Mobile drawer focusable off-canvas; `aria-hidden` is a no-op, `aria-controls` dangles | `AppShell.tsx:187,210,184` |
| UI-COLOR-004 | Form fields and secondary buttons have no perceivable boundary (1.23:1, 1.4.11) | `globals.css:18`, `Field.tsx:35-38` |

`AppShell.tsx:187` is worth reading directly — `aria-hidden={!menuOpen ? undefined : undefined}`
returns `undefined` on both branches. The intent was right; the condition was lost. Add a
regression test alongside the fix, not just the fix.

### High

| ID | Title | Anchor |
|---|---|---|
| UI-MOB-005 | No button size reaches 44px; rotation controls ≈20px | `Button.tsx:19-23`, `TaskForm.tsx:310-336` |
| UI-TYP-006 | Type scale strips every line-height — body prose renders at ~1.2 | `tailwind.config.ts:60-69` |
| UI-A11Y-007 | Inputs kill the focus ring, replace it with a 1px hue shift | `Field.tsx:34-38` + 8 duplicates |
| UI-CONSIST-008 | Primitives unused — six hand-rolled card variants instead | `components/ui/index.ts` |
| UI-COLOR-009 | Tinted chips, success alerts, muted/70 all below 4.5:1 | `Alert.tsx:9`, `Badge.tsx:9` |
| UI-UX-010 | Page errors: unannounced, no retry, two styled as muted grey | six `*Client.tsx` |
| UI-A11Y-011 | No skip link; two nav landmarks share one name (2.4.1, **Level A**) | `AppShell.tsx:149,186,243` |

**UI-TYP-006 deserves a note**, because it is invisible in review. `theme.extend.fontSize`
uses bare strings (`sm: "var(--text-sm)"`). In Tailwind 3.x a string emits `font-size` only,
replacing the framework default `sm: ['0.875rem', { lineHeight: '1.25rem' }]`. So every
`text-*` utility in this codebase sets size and nothing else, and body copy falls back to
the UA's `normal` (~1.15–1.2). `leading-*` appears 12 times in 578 classNames — 11 of them
on the marketing page. The authenticated dashboard sets no line-height anywhere. That is why
the landing page reads better than the product.

### Medium

`UI-UX-012` window.confirm + no undo · `UI-PERF-013` no skeletons, silent transitions ·
`UI-VIS-014` week-grid status is `accent/10` vs `accent/15` (imperceptible) ·
`UI-LAY-015` container width and alignment change per tab · `UI-UX-016` empty states are
dead ends · `UI-A11Y-017` `prefers-reduced-motion` covers only `.mkt-rise` ·
`UI-VIS-018` compressed and inconsistent heading hierarchy · `UI-USA-019` every dashboard
tab is titled "Wispel" · `UI-USA-020` icons are free-text slug fields · `UI-TOKEN-021`
raw hex in two primitives + `text-[11px]`.

### Low

`UI-INT-022` clipboard confirms visually only, fails silently · `UI-INT-023` language
switcher `disabled`s the active locale · `UI-VIS-024` the sole `Card` consumer overrides
its padding.

---

## Suggested sequence

**1 — Tokens (`globals.css`, ~10 lines).** Clears UI-COLOR-001, -004, -009 across every
screen at once.

```css
--color-accent: #0b7d6f;            /* was #0e9f8e — 3.30:1 */
--color-accent-hover: #0a6a5e;
--color-accent-decorative: #0e9f8e; /* mark, progress fills, chart strokes */
--color-border-interactive: #8a929c;/* input + secondary-button boundary, ≥3:1 */
--color-success-text: #14713f;      /* was #1f9254 — 3.60:1 on success-bg */
```

Mirror into `Design System/tokens/` and `THPalettes` per the sync contract in
`globals.css:6-8`.

**2 — Type scale (`tailwind.config.ts`, one block).** Clears UI-TYP-006 and takes half of
UI-MOB-005 with it, since button height is size + padding + border.

```ts
fontSize: {
  xs:  ["var(--text-xs)",  { lineHeight: "1.5" }],
  sm:  ["var(--text-sm)",  { lineHeight: "1.5" }],
  base:["var(--text-base)",{ lineHeight: "1.6" }],
  // display steps keep --leading-tight
}
```

**3 — Two Level A fixes.** `KeyboardSensor` in `WeekPlannerGrid`; `id="sidebar"` + `inert`
on the closed mobile drawer.

**4 — Primitives.** Give `Card` `row` / `panel` / `tinted` variants, migrate the six
hand-rolled containers, add a `min-h-11` to every `Button` size, define one
`:focus-visible` rule in `@layer base` and delete the local `outline-none`s. This is what
makes steps 1–3 stay fixed.

**5 — The rest**, in severity order.

---

## Verification

```bash
# token drift — should return only the documented QR exception (InviteCodeCard.tsx:26-27)
rg -n '\[#[0-9a-fA-F]{3,6}\]|text-\[[0-9]+px\]' apps/web/app apps/web/components

# duplicated card markup — should return zero after step 4
rg -n 'rounded-lg border border-border bg-surface p-4' apps/web

# suppressed focus rings — should return zero after step 4
rg -n 'outline-none' apps/web/app apps/web/components

npm run typecheck -w apps/web
```

The four critical findings are all machine-detectable. The repo already tracks the absent
UX lane as HLT-013; an `axe-core` run over the six dashboard routes plus a contrast
assertion over `globals.css` would have caught every one of them before review.

---

## What is genuinely good

Worth stating plainly, because the finding list above is one-sided by design:

- Real tokens, one source of truth, with a documented three-way sync contract.
- Semantic HTML well above the React norm: `fieldset`/`legend`, `scope="row"` table
  headers, `aria-labelledby` sections, `role="alert"` on `Alert`, `aria-live` on the
  approval queue, correct heading nesting, `inputMode="numeric"` on pincode fields.
- The mobile drawer implements focus trapping, Escape-to-close and focus restoration —
  hard work done properly, let down only by the off-canvas focus bug.
- The hamburger is `h-11 w-11` (44px). The rule is known; it just was not encoded in the
  `Button` primitive.
- The 720px week grid is wrapped in `overflow-x-auto`, so the page body never scrolls
  horizontally at 320px.
- Photo thumbnails use bounded exponential backoff with a real skeleton — the best loading
  treatment in the app, and the model the other five screens should copy.
- The QR code's hardcoded black/white is justified in a comment. That is the right way to
  break a token rule.
- Vandaag's positive-framing buckets (`open`/`awaiting`/`done`, never "te laat") correctly
  implement the product's tone guidance.
- Full nl/en parity — 717 lines each, no hardcoded user-facing strings.
