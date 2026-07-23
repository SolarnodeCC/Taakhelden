---
description: Maakt een nieuw genummerd D1-migratiebestand aan en draait de lokale dry-run.
argument-hint: [korte beschrijving, bijv. add reminders table]
---

Gebruik de `migration-writer` subagent om een nieuwe D1-migratie te maken voor:
**$ARGUMENTS**

Vereisten:
- Nieuw genummerd bestand in `apps/api/migrations/` (volgend nummer, leading zeros).
- Wijzig nooit een bestaande migratie.
- Elke tabel met gezinsdata krijgt een `family_id`-kolom + index.
- Draai daarna vanuit `apps/api`:
  `npx wrangler d1 migrations apply taakhelden-db --local`
  en rapporteer het resultaat.
