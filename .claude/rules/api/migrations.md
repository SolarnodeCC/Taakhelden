---
alwaysApply: false
paths: apps/api/migrations/**/*.sql
---

# D1 migrations (`apps/api/migrations/`)

Migrations are **append-only**. Schema history is immutable once merged.

## Never

- Edit or renumber an existing `NNNN_*.sql` file. PreToolUse hook
  `block-migration-edit.mjs` blocks edits to numbered migrations.
- Delete columns without a deliberate migration plan and API contract update.
- Put application logic in SQL files — only schema changes and seed data approved for
  migrations (e.g. `0003_seed_badges.sql`).

## Always

- Add a **new** sequentially numbered file: `0007_description.sql`.
- Use `/new-migration` or `@migration-writer` for new files.
- Include `family_id` on tenant tables; index foreign keys used in family-scoped queries.
- Test locally before PR:

```bash
npm run db:migrate:local -w apps/api
```

## After migration changes

- Update repo functions if columns changed — routes still never contain SQL.
- If API shape changes: Zod schemas in `packages/shared` first.
- Run `npm test` — Vitest applies migrations in the Workers test pool.

## Proof lane

`agent/test-map.json` maps `apps/api/migrations/` → local migrate command above.
