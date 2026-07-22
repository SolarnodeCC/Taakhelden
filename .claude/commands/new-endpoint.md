---
description: Zet een nieuw API-endpoint op volgens de TaakHelden-architectuur (Zod-schema + repo + route + authz-test).
argument-hint: [resource-naam, bijv. reminders]
---

Gebruik de `endpoint-scaffold` skill om een nieuw endpoint voor de resource
**$ARGUMENTS** op te zetten.

Doorloop alle vier de lagen in volgorde en sla er geen over:
1. Zod-schema in `packages/shared/src/schemas/$ARGUMENTS.ts` + export via `index.ts`.
2. Repo-functie(s) in `apps/api/src/repo/$ARGUMENTS.ts` met `familyId` als eerste arg.
3. Hono-route in `apps/api/src/routes/$ARGUMENTS.ts` (alleen repo-aanroepen) + registreren
   in `apps/api/src/index.ts`.
4. Authz-test in `apps/api/test/$ARGUMENTS.test.ts`.

Sluit af met `npm run typecheck` en `npm test`, en controleer de zes harde regels.
