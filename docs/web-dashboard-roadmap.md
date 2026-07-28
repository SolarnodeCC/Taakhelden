# Web dashboard — roadmap & backlog

Centraal overzicht van onderdelen die in het product staan maar nog niet (volledig)
in `apps/web` zijn gebouwd. Implementatieplannen per batch:
`docs/web-batch-*-plan.md`.

**Laatst bijgewerkt:** na Batch 12 (weekplanner drag-drop); Inzichten blijft Fase 2.

## Openstaande onderdelen

| Onderwerp | Waar gepland | Notitie |
| --- | --- | --- |
| **Inzichten** (statistieken/trends) | Batch 6 / Fase 2 | Nog `SectionStub` op `/inzichten` |
| SIWA op web, wachtwoord-vergeten, marketing-landing, profielfoto-upload | Diverse batches / post-MVP | Bewust buiten scope gebleven (zie hieronder) |

## Bewust buiten web-MVP (niet in batches 1–12)

Deze items komen terug in meerdere batch-plannen als **niet in deze batch**; er is
nog geen apart batch-nummer voor:

| Onderwerp | Waar genoemd | Korte notitie |
| --- | --- | --- |
| Sign in with Apple op web | Batch 7–11 | iOS/SIWA primair; web gebruikt e-mail/wachtwoord |
| Wachtwoord vergeten | Batch 7–10 | Geen reset-flow op web |
| Marketing-landing | Batch 7–10 | Dashboard-only; geen publieke site in repo |
| Profielfoto-upload (presigned) | Batch 7, 10 | API ondersteunt foto's; web-upload UI ontbreekt |
| Device-sessions revoke | Batch 8, 10 | API mogelijk; geen web-UI |
| Kind-login op web | Batch 7–10 | Kind-app is iOS; web is ouder-only |

## Batch-overzicht (1–12)

| Batch | Inhoud | Status |
| --- | --- | --- |
| 1–3 | i18n, auth/BFF, app-shell + nav | Done |
| 4 | Vandaag + Goedkeuren | Done |
| 5 | Taken + Winkel (basis-CRUD) | Done |
| 6 | Inzichten | Stub — zie backlog |
| 7 | Registratie + Gezin/kinderen | Done |
| 8 | Co-ouder + gezinsinstellingen | Done |
| 9 | Taken-verdieping (templates, weekoverzicht read-only) | Done |
| 10 | Notificaties + punten + privacy/AVG | Done |
| 11 | Realtime WebSocket (Vandaag, Goedkeuren, Winkel) | Done — [web-batch-11-plan.md](./web-batch-11-plan.md) |
| 12 | Weekplanner drag-drop (instance-move) | Done — [web-batch-12-plan.md](./web-batch-12-plan.md) |
