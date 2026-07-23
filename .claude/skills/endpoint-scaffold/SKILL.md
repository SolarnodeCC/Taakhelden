---
name: endpoint-scaffold
description: Zet een nieuw API-endpoint op in de TaakHelden Worker volgens de architectuur — Zod-schema in packages/shared, repo-functie met familyId als eerste argument, Hono-route die alleen repo-functies aanroept, en de verplichte authz-test. Gebruik bij "nieuw endpoint", "nieuwe route", of "nieuwe resource".
---

# Endpoint scaffold

Volg deze checklist bij elke nieuwe route (uit `CLAUDE.md` → Workflow). De vier lagen
horen bij elkaar; sla er geen over.

> Concrete, copy-pasteerbare code-templates voor alle vier de lagen staan in
> [`references/templates.md`](references/templates.md) — lees dat bestand pas wanneer je
> gaat scaffolden (progressive disclosure), niet op voorhand.

## 1. Zod-schema in `packages/shared`
- Voeg een schema toe in `packages/shared/src/schemas/<resource>.ts` (body + response).
- Exporteer het via `packages/shared/src/index.ts`.
- Nieuwe foutcodes? Voeg ze toe aan `packages/shared/src/errors.ts` (`ErrorCodes`).
- Bekijk een bestaand schema als voorbeeld: `packages/shared/src/schemas/task.ts`.

## 2. Repo-functie in `apps/api/src/repo/<resource>.ts`
- **`familyId` is het eerste argument ná de DB-handle** — dit is de security-grens.
- Elke query filtert op `family_id = ?`. Nooit een query zonder dat filter.
- Alle SQL leeft hier; routes bevatten nooit `.prepare(`.
- ID's via `newId("<prefix>")` uit `services/ids.ts`.
- Voorbeeld: `apps/api/src/repo/tasks.ts` (`listTasks`, `getTask`, `createTask`).

## 3. Route in `apps/api/src/routes/<resource>.ts`
- Hono-router; haal `familyId` uit `requireParent(c)` / de authz-middleware.
- Valideer input met `validate("json", <Schema>)` uit `middleware/validate.ts`.
- Roep alléén repo-functies aan, geef `c.env.DB` en `familyId` door.
- Mutaties (POST/PATCH/DELETE) lopen via de `Idempotency-Key`-header
  (`middleware/idempotency.ts`) en — als ze punten raken — via de FamilyRoom DO.
- Registreer de router in `apps/api/src/index.ts`.
- Voorbeeld: `apps/api/src/routes/tasks.ts`.

## 4. Authz-test in `apps/api/test/<resource>.test.ts` (CI-verplicht)
- Minimaal: cross-family toegang weigeren (403/404) en rol-overschrijding weigeren.
- Gebruik de helpers uit `apps/api/test/helpers.ts`: `seedFamily`, `parentToken`,
  `childToken`, `api`, `todayAmsterdam`.
- Patroon: `apps/api/test/authz.test.ts`.

## Afronden — verificatie (niet overslaan)
Bevestig elk punt met bewijs, ga niet af op aanname:
- [ ] Zod-schema bestaat én is geëxporteerd via `packages/shared/src/index.ts`.
- [ ] Elke repo-functie heeft `familyId` als eerste arg en elke query filtert op
      `family_id = ?`. Controleer met: `rg -n 'family_id' apps/api/src/repo/<resource>.ts`.
- [ ] Route bevat geen ruwe SQL: `rg -n '\.prepare\(|\.batch\(' apps/api/src/routes/<resource>.ts`
      geeft niets terug.
- [ ] Router is gemount in `apps/api/src/index.ts`.
- [ ] Authz-test bestaat en dekt cross-family + rol-overschrijding.
- [ ] `npm run typecheck` en `npm test` groen (plak de uitkomst, verzin die niet).
- [ ] Zes harde regels nagelopen — draai `/arch-check` (`@architecture-reviewer`).
- [ ] Kindgerichte strings in positieve NL-toon (`@dutch-child-copy`).
