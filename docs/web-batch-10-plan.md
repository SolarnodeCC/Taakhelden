# Web dashboard — Batch 10 plan

Planning voor de tiende bouwslag van het ouder-dashboard (`apps/web`). Dit
document is de scope- en aanpakafspraak; de implementatie volgt in een aparte PR
**nadat Batch 9 is gemerged** (Batch 10 bouwt voort op Taken-verdieping +
route-guards).

## Waar we staan (batch 1–9)

| Batch | Inhoud | Status |
| --- | --- | --- |
| 1–3 | i18n, auth/BFF, app-shell + nav | Done |
| 4 | **Vandaag** + **Goedkeuren** | Done |
| 5 | **Taken** + **Winkel** (basis-CRUD) | Done |
| 6 | **Inzichten** | Stub — Fase 2 |
| 7 | **Registratie** + **Gezin/kinderen** + gezinscode/QR | Done |
| 8 | **Co-ouder** + **gezinsinstellingen** + route-guards | Done |
| 9 | **Taken-verdieping** (templates, roulatie, weekoverzicht) | Done / merge pending |
| **10** | **Notificaties** + **punten/ledger** + **privacy/AVG** | Dit plan |

Na Batch 7–9 kan een ouder het gezin volledig opzetten en taken plannen. Wat
product §3.1 / §3.7 / §3.10 belooft maar de web-UI nog mist:

- **Notificatie-instellingen per kind** (aan/uit, eigen bedtijdvenster).
- **Punten inzien en handmatig bijboeken** (ledger + positieve adjustment).
- **AVG-rechten**: data-export (art. 20) en gezinsverwijdering (art. 17), plus
  het in Batch 7 uitgestelde **kindprofiel verwijderen**.

De API is hiervoor grotendeels klaar: `GET/PATCH /notification-settings`,
`GET /points/ledger`, `POST /points/adjust`, `POST/GET /account/export`,
`DELETE /account`, `DELETE /members/{id}`. Geen Worker-migratie verwacht;
eventueel kleine API-hardening (zie open vraag 5).

## Scope van batch 10 — oudercontrole: **Notificaties** + **Punten** + **Privacy**

Batch 10 sluit het gat tussen “dagelijks dashboard” en “volledig gezinsbeheer”.
Dit is de privacy/AVG-batch die in Batch 7 bewust is uitgesteld, plus de
notificatie- en punten-oppervlakken die Batch 8–9 naar voren schoven.

1. **Notificatie-instellingen per kind** — push aan/uit + optioneel eigen
   quiet-hours (anders gezinsvenster uit Batch 8).
2. **Punten & ledger** — saldo + grootboek per kind; handmatige bijboeking met
   reden (alleen positief).
3. **Privacy & account** — AVG-export (async ZIP), gezinsverwijdering met
   wachtwoordbevestiging, kindprofiel soft-delete.

### Waarom deze drie, en niet Inzichten / WS / drag-drop

- **Sluit het “Batch 10+”-gat.** Batches 7–9 noemen dit consistent als volgende
  stap; de API en Zod-schema's bestaan al.
- **Privacy is een productbelofte.** Art. 8-toestemming bij kind-create (Batch 7)
  hoort bij export + verwijdering (art. 20/17) in dezelfde ouder-flow.
- **Notificaties raken kind-UX.** Product §3.7: max. 2/dag, nooit na bedtijd,
  positieve copy — daarom beheert de ouder dit, niet het kind.
- **Punten-adjustment is een MVP-use-case.** “Taak buiten de app om” (spec §3.7)
  zonder negatieve mechaniek (architectuurregel 4).
- **Inzichten** blijft Fase 2 (Batch 6-stub; analytics/rapportage).
- **Realtime WebSocket** verbetert Vandaag/Goedkeuren maar is geen blocker voor
  bovenstaande drie — voorstel: **Batch 11** (of stretch in Batch 10, zie open
  vraag 4).
- **Drag-drop weekplanner** vereist nieuw instance-move-contract (Batch 9) —
  bewust **niet** in deze batch.

### Afhankelijkheid

```
Batch 9 merged → Branch vanaf main → Batch 10 implementatie-PR
```

Zonder `/gezin`, `RequireFullParent`, `apiClient` patch/post/delete, en
`GET /members` is dit plan niet implementeerbaar.

### Buiten scope (volgende batches)

- **Batch 11 — Realtime**: WebSocket-client op Vandaag/Goedkeuren
  (`POST /ws/token` + `GET /ws`).
- **Batch 11+ — Weekplanner drag-drop**: instance verplaatsen (nieuw API-contract).
- **Fase 2 — Inzichten**: statistieken, streaks-dashboard, ouder-analytics.
- **Niet in deze batch**: SIWA op web, wachtwoord-vergeten, marketing-landing,
  device-sessions revoke, kind-login op web, profielfoto-upload (presigned),
  wijziging eigen ouder-wachtwoord, invite revoke-API.

## Wat we bouwen

### 1. Notificatie-instellingen per kind

**Plaats**: nieuwe sectie op `/instellingen` (voorstel) of uitbreiding `/gezin`
(zie open vraag 1).

- **Data**: `GET /api/v1/notification-settings` → `{ settings: NotificationSetting[] }`.
  Merge met `GET /members` (alleen `role === "child"`) voor roepnaam/avatar.
- **Per kind-kaart**:
  | Veld | UI | Gedrag |
  | --- | --- | --- |
  | `enabled` | Toggle | Standaard `true` (API-default). Uit = geen push naar dit kind. |
  | `quietStart` / `quietEnd` | Twee `type="time"` of leeg | `null` = neem gezins-`quietStart`/`quietEnd` over (Batch 8). Eigen venster overschrijft alleen voor dit kind. |
- **Opslaan**: `PATCH /api/v1/notification-settings` per wijziging (debounced
  of expliciete “Opslaan”-knop per kaart — voorstel: **per-kaart opslaan** om
  partial PATCH te respecteren).
- **Copy**: korte uitleg dat dit push naar de kind-app betreft; verwijs naar
  gezins-bedtijd in Instellingen/Gezin als fallback. Geen schuldtaal.
- **Permissie**: `full` parent only (`PATCH` vereist `full` op API).

### 2. Punten & ledger

**Plaats**: per-kind flow vanuit `/gezin` (voorstel: actie **Punten** op
kindrij → panel/dialoog) of aparte route `/punten` (open vraag 2).

#### 2a. Saldo-overzicht

- **Data**: `GET /api/v1/points/balance` → `ParentBalancesView` (`children[]`
  met `balance`, `todayCompleted`, `weekProgress`, `streakDays`, …).
- Toon compact saldo op kindkaart in Gezin (optioneel) en uitgebreid in het
  punten-panel.

#### 2b. Grootboek (ledger)

- **Data**: `GET /api/v1/points/ledger?childId={id}&limit=50` + cursor-paginatie
  via `nextCursor`.
- **Tabel/lijst**: `type` (vertaald label), `amount` (+), `note`, `at`
  (locale datum/tijd). Types: `task`, `photo_bonus`, `day_bonus`, `week_bonus`,
  `redemption`, `redemption_cancel`, `adjustment`, `badge`.
- **“Meer laden”** zolang `nextCursor !== null`.
- **Privacy**: toon geen ruwe `ref`-id's in de UI; alleen menselijk label.

#### 2c. Handmatige bijboeking

- **Formulier** (alleen `full`):
  - `amount` — integer 1–1000 (schema `AdjustBody`)
  - `note` — verplicht, 1–200 tekens (bijv. “Extra hulp in de tuin”)
- **Actie**: `POST /api/v1/points/adjust` met **`Idempotency-Key`** header
  (via `apiClient.post` — zelfde patroon als andere mutaties).
- **Na succes**: ledger verversen + saldo updaten; bevestiging in kalme
  ouder-copy (“Punten toegevoegd”).
- **Geen negatieve bedragen** — UI blokkeert; API weigert ook.

### 3. Privacy & account

**Plaats**: sectie **Privacy & account** op `/instellingen` (voorstel) of onder
`/gezin` (open vraag 1).

#### 3a. Kindprofiel verwijderen (Batch 7-nasleep)

- **Actie** op kindrij in `/gezin`: **Verwijderen** (destructief, secundaire
  stijl).
- **Bevestiging**: dialoog met roepnaam + uitleg 7-dagen soft-delete venster
  (indien API dat teruggeeft) en dat taken/punten/historie mee verdwijnen na
  purge.
- **Endpoint**: `DELETE /api/v1/members/{childId}`.
- **Na succes**: kind uit lijst; redirect/geen panel meer voor dat kind.

#### 3b. Data-export (AVG art. 20)

- **Start**: knop “Download mijn gegevens” → `POST /api/v1/account/export`
  → `{ exportId, status: "pending" }`.
- **Polling**: `GET /api/v1/account/export/{exportId}` elke ~2 s (max timeout
  ~2 min) tot `status === "ready"` of `failed`.
- **Download**: bij `ready` toon link `downloadUrl` (kortlevend, HMAC) —
  open in nieuw tabblad of `window.location`. Copy: link verloopt binnen X min.
- **Fout**: `failed` → rustige melding + opnieuw proberen.
- **Geen** e-mailafhankelijkheid in de UI (API kan mail sturen; web toont
  status inline).

#### 3c. Gezin verwijderen (AVG art. 17)

- **Sectie** onderaan, visueel gescheiden (danger zone).
- **Formulier**:
  - Checkbox: “Ik begrijp dat alles na 7 dagen definitief wordt verwijderd.”
  - `password` — huidig wachtwoord (verplicht voor e-mail/wachtwoord-accounts)
  - SIWA-accounts: `appleIdentityToken` — **buiten scope** tenzij SIWA op web
    bestaat; toon dan alleen e-mail-flow of disabled state met uitleg.
- **Actie**: `DELETE /api/v1/account` met `AccountDeleteBody`.
- **Na succes**: `POST /api/auth/logout` (cookies wissen) → redirect `/login`
  met bevestiging (`purgeAfter` datum tonen).
- **Permissie**: alleen `full` parent.

## Techniek & conventies

- **Datapatroon**: client-component + `apiClient` + Zod, zoals Batch 5–9.
- **Shared / web types**:
  - Importeer `NotificationSetting`, `NotificationSettingsPatch`, `AdjustBody`,
    `ExportJobView`, `AccountDeleteBody`, `AccountDeleteResult` uit
    `@taakhelden/shared` waar mogelijk.
  - Web `types.ts`: ledger-entry view, balance parse (deels al in
    `types.test.ts`).
- **BFF**: bestaande `/api/v1/[...path]` — `DELETE` werkt al via proxy.
  Geen nieuwe auth-routes (behalve logout na delete).
- **i18n** (`nl` + `en`):
  - `instellingen.notifications.*` of `gezin.notifications.*`
  - `punten.*` (saldo, ledger-types, adjust-form)
  - `privacy.*` (export, delete-family, delete-child, bevestigingen)
  - `nav.instellingen` (indien nieuwe nav)
- **Privacy**: log nooit roepnamen, wachtwoorden, export-URL's of ledger-notities
  in `console`/errors (architectuurregel 5).
- **Design**: ouder-register; `Field` / `Input` / `Button` / `Card` / `Alert`.
  Danger zone: `Alert tone="danger"` + secundaire destructive buttons. Geen
  kid-chrome. Tokens, geen ruwe hex.
- **Permissie**: alle nieuwe secties achter `RequireFullParent`; export mag
  `approve_only` theoretisch ook (API: alleen `requireParent`), maar voorstel:
  **alles `full`** voor consistentie met gezinsbeheer.

## Tests & kwaliteit

- API: notification-settings, points adjust/ledger, account export/delete,
  member delete — authz-tests bestaan (`iteration4.test.ts`, `account.test.ts`,
  members). Web-batch; alleen API-touch bij idempotency-gap (open vraag 5).
- Web:
  - Schema-tests: `NotificationSettingsResponse`, ledger page, `AdjustBody`,
    `ExportJobView` parse.
  - Logic: export polling helper; adjust form validatie (`amount` ≥ 1, `note`
    non-empty).
- Handmatige rooktest:
  1. Kind notificaties uit + eigen bedtijd → PATCH persisted na refresh.
  2. Ledger tonen → “meer laden” met cursor.
  3. Bijboeking + idempotency → saldo stijgt; dubbele submit geen dubbele punten.
  4. Export start → poll → ZIP download werkt.
  5. Kind verwijderen → uit lijst; Vandaag toont kind niet meer.
  6. Gezin verwijderen met fout wachtwoord → geen delete.
  7. Gezin verwijderen correct → uitgelogd, login werkt niet meer met oude sessie.
  8. `approve_only` op nieuwe routes → guard.
  9. Locale EN: alle nieuwe copy vertaald.
- `npm run typecheck` + `lint` + web-tests groen; CI groen.

## Definition of done

- [ ] Notificatie-instellingen per kind lezen en opslaan (`enabled`, quiet hours).
- [ ] Per kind: saldo + ledger met paginatie; handmatige bijboeking met reden.
- [ ] Kindprofiel verwijderen met bevestiging.
- [ ] AVG-export: start → status → downloadlink.
- [ ] Gezinsverwijdering met wachtwoord + logout + redirect.
- [ ] `full`-only guards op alle nieuwe UI.
- [ ] nl + en strings compleet; kalme ouder-copy; geen schuldtaal bij privacy.
- [ ] Geen PII/wachtwoorden/export-URL's in logs.
- [ ] `typecheck` + lint groen; CI groen.
- [ ] Batch 9 is basis (gemerged).

## Acceptatiecriteria (PO-vriendelijk)

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | Ouder zet push uit voor kind X | PATCH slaat op; GET toont `enabled: false` |
| 2 | Kind Y eigen bedtijd 20:00–07:30 | Overschrijft gezinsvenster voor dat kind |
| 3 | Ouder opent punten voor kind | Saldo + ledger-regels zichtbaar |
| 4 | Bijboeking 10 punten + reden | Saldo +10; ledger-type `adjustment` |
| 5 | Dubbele submit bijboeking (zelfde Idempotency-Key) | Geen dubbele punten |
| 6 | Data-export starten | Status pending → ready; downloadlink werkt |
| 7 | Kind verwijderen | Kind verdwijnt uit gezin-UI |
| 8 | Gezin verwijderen met fout wachtwoord | Foutmelding; gezin blijft |
| 9 | Gezin verwijderen correct | Uitgelogd; `purgeAfter` getoond |
| 10 | `approve_only` opent instellingen/punten | Guard-melding |
| 11 | Locale EN | Alle nieuwe copy in het Engels |

## Open vragen voor review

1. **Nav-structuur**:
   - **A (voorstel):** nieuwe nav **Instellingen** (`/instellingen`, `requiresFull`)
     met secties Notificaties + Privacy & account; punten blijft kind-gecentreerd
     vanuit `/gezin`. `/gezin` blijft voor code, kinderen, co-ouder, gezinsflags.
   - **B:** alles als extra secties op `/gezin` (geen nav-groei; langere pagina).
2. **Punten-UI-plaats**:
   - **A (voorstel):** actie “Punten” per kind op `/gezin` → slide-over/panel.
   - **B:** aparte route `/punten` met kind-tabs + ledger + adjust.
3. **Export-UX**: inline polling in het dashboard (voorstel) vs. e-mail-only
   (API ondersteunt beide; web focust op inline).
4. **WebSocket (realtime Vandaag/Goedkeuren)**: meenemen als stretch in Batch 10,
   of expliciet **Batch 11** houden om scope te beperken?
5. **API-hardening**: `POST /points/adjust` vereist nu `idempotency`-middleware
   in code — bevestig dat web altijd `Idempotency-Key` meestuurt; voeg API-test
   toe als die ontbreekt.
6. **SIWA-delete**: `DELETE /account` ondersteunt `appleIdentityToken` — web
   toont alleen wachtwoord-flow tot SIWA op web bestaat (ok?).

## Agents / skills bij implementatie

| Onderdeel | Agent / skill |
| --- | --- |
| Instellingen, punten-panel, privacy-secties | `@taakhelden-web` |
| AVG/privacy copy + adjust-toon | `@taakhelden-product-owner` |
| nl/en catalogs | `@taakhelden-i18n` |
| Privacy/consent UX review | `@taakhelden-security` |
| Design tokens / danger zone | `design-system` skill → `/design-check` |
| Idempotency + geen SQL in web | `@architecture-reviewer` |
| Tests | `@taakhelden-tester` |
| Alleen bij WS-stretch | `@taakhelden-architect` + `@taakhelden-backend` |

## Samenvatting

Batch 10 maakt het ouder-dashboard **compleet voor beheer en privacy**: per-kind
notificaties, transparante punten met handmatige bijboeking, en AVG-export/
verwijdering inclusief kindprofiel-delete. Alles leunt op bestaande API's; de
werk is vooral web-UI, i18n en zorgvuldige bevestigingsflows. Realtime WS en
Inzichten blijven bewust later.
