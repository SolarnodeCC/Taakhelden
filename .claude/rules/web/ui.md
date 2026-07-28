---
alwaysApply: false
paths: apps/web/**/*.tsx,apps/web/**/*.css,apps/web/tailwind.config.ts
---

# Web UI (`apps/web/`)

Parent dashboard register: **calm, neutral** — not kid/teen chrome. Skill `design-system`
has the full playbook; this file lists **hard never-rules**.

## Tokens — never raw values (HLT-013 partial)

- Use Tailwind utilities mapped to CSS variables: `bg-accent`, `text-muted`, `rounded-xl`,
  `shadow-sm`, `border`.
- **Never** hardcode hex (`#0e9f8e`) or arbitrary px for values that exist as tokens.
- Token source: `apps/web/app/globals.css` (mirror changes in `Design System/tokens/`).
- Kid palette (`bg-kid-coral`, etc.) is for kid surfaces — not default dashboard chrome.

## Primitives

- Import from `apps/web/components/ui/` (`Button`, `Card`, `Field`, `Badge`, `Alert`, …).
- Do not duplicate primitive markup inline.

## Data from API (HLT-031)

- No `as unknown as` on API responses — use types from `packages/shared` / `lib/api/types`.
- Validate or narrow at the boundary when shapes are uncertain.

## UX QA gap (known)

- No Storybook or Playwright suite yet (Jankurai HLT-013). Minimum bar for UI PRs:
  tokens, primitives, keyboard/focus sanity, status not color-only.
- Run `/design-check` (`@ui-design-reviewer`) on user-facing diffs.

## Copy and a11y

- User strings via `messages/nl.json` and `messages/en.json` — both locales.
- Child-facing text: positive Dutch tone — `@dutch-child-copy` for new kid copy.
- WCAG 2.1 AA: focus visible, labels on fields, no color-only status.

## Verification

```bash
rg -n '#[0-9a-fA-F]{3,6}' apps/web/app apps/web/components
npm run typecheck -w apps/web
```
