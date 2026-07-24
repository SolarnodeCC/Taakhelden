---
name: developing-frontend
description: Implements the TaakHelden parent dashboard — Next.js App Router, TypeScript, next-intl localization, and Tailwind styling in apps/web. Use when working on pages, components, hooks, or UI styling. Accessibility (WCAG 2.1 AA), Dutch-first copy, and mobile-first are non-negotiable.
---
# Skill: Web Development (TaakHelden parent dashboard)
# SCOPE: Next.js pages/components, data fetching, next-intl, Tailwind styling
# LOAD: when working on apps/web/
# OWNER: Web Lead

## Role
Senior web developer. You own the Next.js parent dashboard (`apps/web`), server/client
component structure, next-intl localization, Tailwind styling, and WCAG 2.1 AA
accessibility. Dutch-first copy and mobile-first are non-negotiable.

## Preconditions / Inputs
- Page/component to implement
- The API contract from `packages/shared` (DTOs) — never redeclare backend types
- Which locale strings are needed (next-intl catalog)
- Accessibility + mobile viewport constraints

## Workflow

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

**Stack**: Next.js App Router + TypeScript strict · next-intl (`[locale]` routing) ·
Tailwind (`tailwind.config.ts`) · Server + Client Components · fetch/SWR (no Redux).

## Key Patterns

### Localization (next-intl — Dutch is primary)

```tsx
// Never hardcode UI text — every string comes from a catalog
import { useTranslations } from 'next-intl'
const t = useTranslations('tasks')
return <h1>{t('title')}</h1>

// Routing/navigation via apps/web/i18n/navigation.ts (locale-aware Link/redirect)
// Numbers/dates/currency via Intl (nl-NL) — never hardcode formats
```

Child-facing strings defer to `@dutch-child-copy` for positive tone (§3.7).

### Data fetching (contract-typed)

```tsx
// Server Component: fetch on the server, pass typed data down
import type { Task } from '@taakhelden/shared'
async function TasksPage() {
  const tasks: Task[] = await api('/tasks')      // helper in apps/web/lib/api/
  return <TaskList tasks={tasks} />
}

// Client Component: SWR for interactive/refreshing data — reuse the shared fetcher
const { data, error, isLoading, mutate } = useSWR('/tasks', fetcher)
```

Auth/session/cookies go through `apps/web/lib/api/{config,cookies}.ts` and `middleware.ts`.

## Accessibility (non-negotiable — every PR is reviewed on this)

### Touch targets (WCAG 2.5.5) — ≥ 44×44px

```tsx
<button className="min-h-[44px] px-4 py-3">Label</button>
<button className="w-[44px] h-[44px] grid place-items-center" aria-label="Verwijderen"><TrashIcon /></button>
// ✗ FORBIDDEN: <button className="h-8 px-2">Te klein</button>
```

### Colour contrast (WCAG 2.1 AA — 4.5:1 min for text), aria & focus

```tsx
<button aria-label="Sluiten"><XIcon /></button>                 // icon-only needs aria-label
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">…</div>   // focus-trapped
<div aria-live="polite">{points} punten</div>                   // live point/task updates
// Use design tokens / CSS vars for colour — no arbitrary hex for text
```

### Loading & error states (in Dutch)

```tsx
{isLoading ? (
  <div aria-busy="true" aria-label="Laden…" className="animate-pulse …" />
) : error ? (
  <p role="alert" className="text-red-600 …">Er ging iets mis. Probeer het opnieuw.</p>
) : <ActualContent />}

<button disabled={saving} aria-disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
```

## PR Checklist

```
□ npm run typecheck passes
□ Every visible string comes from a next-intl catalog (no hardcoded NL/EN)
□ Child-facing copy reviewed by @dutch-child-copy (positive tone)
□ All buttons ≥ 44px height; icon-only buttons have aria-label
□ Focus ring visible on Tab; active state on mobile
□ Loading + error states (in NL) for all async data
□ DTOs imported from packages/shared (no duplicated backend types)
□ Shared fetch/SWR helpers used (no copy-pasted loading/error hook)
□ Tested at 375px viewport
□ No child PII or photo URLs in logs/analytics
```

## Docs to Update
| Change | Doc |
|---|---|
| New accessible component pattern / a11y decision | `docs/taakhelden-productvoorstel.md` (UI-richtlijnen) |
| New parent-dashboard flow | `docs/taakhelden-productvoorstel.md` |
