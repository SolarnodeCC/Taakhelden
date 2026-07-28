# Web dashboard — Batch 12 plan

Planning voor de twaalfde bouwslag van het ouder-dashboard (`apps/web`) plus het
bijbehorende **instance-move API-contract** in de Worker. Dit document is de
scope- en aanpakafspraak; de implementatie volgt in een aparte PR **nadat Batch
11 is gemerged** (Batch 12 bouwt voort op het read-only weekoverzicht uit Batch
9 en de realtime-client uit Batch 11).

> Centraal backlog-overzicht (Inzichten, post-MVP):
> [`web-dashboard-roadmap.md`](./web-dashboard-roadmap.md).

## Waar we staan (batch 1–11)

| Batch | Inhoud | Status |
| --- | --- | --- |
| 1–3 | i18n, auth/BFF, app-shell + nav | Done |
| 4 | **Vandaag** + **Goedkeuren** | Done |
| 5 | **Taken** + **Winkel** (basis-CRUD) | Done |
| 6 | **Inzichten** | Stub — Fase 2 |
| 7 | **Registratie** + **Gezin/kinderen** + gezinscode/QR | Done |
| 8 | **Co-ouder** + **gezinsinstellingen** + route-guards | Done |
| 9 | **Taken-verdieping** (templates, roulatie, weekoverzicht read-only) | Done |
| 10 | **Notificaties** + **punten/ledger** + **privacy/AVG** | Done |
| 11 | **Realtime** (FamilyRoom WS: Vandaag, Goedkeuren, Winkel) | Done |
| **12** | **Weekplanner drag-drop** (instance verplaatsen) | Dit plan |

Na Batch 11 is het dashboard live op Vandaag, Goedkeuren en Winkel. Wat product
§3.6 nog belooft maar de web-UI mist:

- **Weekplanner (drag & drop op web)** — een ouder sleept een geplande taak naar
  een andere dag of een ander kind, zonder de taakdefinitie te wijzigen.

Batch 9 leverde het **read-only weekgrid** (`WeekOverview.tsx` op tab Week in
`/taken`). Er is **geen** endpoint om een instance van datum of kind te
verplaatsen; `UNIQUE (task_id, child_id, date)` in D1 voorkomt stille duplicaten
maar blokkeert ook een naïeve `UPDATE` zonder conflictafhandeling.

## Scope van batch 12 — weekplanner: **instance-move API** + **drag-drop UI**

Batch 12 sluit het laatste product-MVP-gat op `/taken`: interactieve planning.

1. **Nieuw API-contract** — `POST /instances/{id}/move` (ouder, idempotent,
   via FamilyRoom-DO).
2. **Weekgrid met drag-drop** — per-kind rijen, kolommen ma–zo; slepen tussen
   cellen wijzigt datum en/of kind.
3. **Realtime-sync** — weekoverzicht ververst op `instance.updated` (Batch 11
   infra hergebruiken).

### Waarom drag-drop nu, en niet Inzichten / post-MVP

- **Productbelofte.** Productvoorstel §3.6: “weekplanner (drag & drop op web)”.
  iOS-bouwvoorstel noemt web-pariteit expliciet.
- **Batch 9 legde de basis.** Read-only weekgrid, data-fetch en week-navigatie
  bestaan; alleen interactie + API ontbreken.
- **Realtime is klaar.** Batch 11 levert WS-refetch; co-ouder die op ander
  device sleept → ander device ziet de wijziging live.
- **Geen nieuw datamodel.** Een instance-move is een `UPDATE` op
  `task_instances.date` / `child_id` — geen migratie, geen ledger-wijziging.
- **Inzichten** blijft Fase 2 (analytics, geen drag-drop-afhankelijkheid).
- **Post-MVP** (SIWA, marketing-landing, profielfoto-upload, enz.) blijft
  buiten alle batches.

### Afhankelijkheid

```
Batch 11 merged → Branch vanaf main → Batch 12 implementatie-PR
```

Zonder `WeekOverview`, `RequireFullParent`, `apiClient` post + idempotency-key,
en `FamilyRealtimeProvider` is dit plan niet implementeerbaar.

### Buiten scope (volgende batches / Fase 2)

- **Fase 2 — Inzichten**: statistieken, trends, streaks-dashboard.
- **Taakdefinitie wijzigen vanuit grid**: klik opent nog steeds taak-edit
  (Batch 9); geen inline edit van titel/punten in het grid.
- **Nieuwe instances aanmaken via drag**: alleen **verplaatsen** van bestaande
  open instances; geen “sleep sjabloon naar dag” (taak-create blijft via form).
- **Niet in deze batch**: `badge.earned`-UI, kind-WS, SIWA, marketing-landing,
  profielfoto-upload, device-sessions revoke.

## Wat we bouwen

### 1. Shared contract — `MoveInstanceBody` + foutcode

**Plaats**: `packages/shared/src/schemas/instance.ts`

```ts
export const MoveInstanceBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  childId: z.string().min(1),
});
```

- Beide velden **verplicht** in de request (client stuurt het volledige
  doel-slot). Server valideert dat minstens één veld afwijkt van de huidige
  instance.
- Response: bijgewerkte `InstanceView` (zelfde vorm als history/today).
- Nieuwe foutcode (indien nodig): `INSTANCE_SLOT_TAKEN` (409) wanneer
  `UNIQUE (task_id, child_id, date)` botst; `INVALID_STATUS` (409) wanneer de
  instance niet verplaatsbaar is.

**API-spec** (`docs/taakhelden-api-specificatie.md` §instances): documenteer
`POST /instances/{id}/move` naast complete/approve/redo.

### 2. Worker — repo + service + DO + route

#### Repo (`apps/api/src/repo/instances.ts`)

- `moveInstance(db, familyId, instanceId, { date, childId })` — atomische
  `UPDATE` met `WHERE family_id = ? AND id = ? AND status IN ('open','open_redo')`.
- Vang SQLite `UNIQUE constraint failed` af → `INSTANCE_SLOT_TAKEN`.

#### Service (`apps/api/src/services/instanceService.ts` — nieuw)

`applyMoveInstance(db, familyId, instanceId, actor, target)`:

| Regel | Gedrag |
| --- | --- |
| Authz | Alleen ouder met rol `full` (zelfde als taak-CRUD) |
| Status | Alleen `open` of `open_redo` |
| Datum | `target.date >= localDate(family.timezone)` — geen verplaatsen naar verleden |
| Kind | `target.childId` moet actief kind in het gezin zijn |
| Taak-scope | Instance hoort bij een niet-gearchiveerde taak van het gezin |
| Geen punten | Geen ledger-write; status en `points_earned` blijven ongewijzigd |
| Idempotentie | Zelfde body op dezelfde instance → 200 met huidige view (geen error) |

#### FamilyRoom-DO (`apps/api/src/do/FamilyRoom.ts`)

- Nieuw pad: `POST /move` met `{ instanceId, date, childId }`.
- Broadcast: `instance.updated` met `{ instanceId, status, childId, date }`.
  Optioneel `date` toevoegen aan WS-payload in shared (backwards compatible).

#### Route (`apps/api/src/routes/instances.ts`)

```ts
instances.post("/:id/move", requireIdempotencyKey, idempotency, validate("json", MoveInstanceBody), async (c) => {
  requireParent(c); // + full-role check
  return callFamilyRoom(c, "/move", { instanceId: c.req.param("id"), ...c.req.valid("json") });
});
```

#### Tests (`apps/api/test/instances-move.test.ts`)

- Happy path: datum wijzigen, kind wijzigen, beide.
- Conflict: doelslot bezet → 409.
- Status `submitted` / `approved` → 409 `INVALID_STATUS`.
- Verleden-datum → 400.
- Idempotency: dubbele POST metzelfde key → zelfde response.
- Authz: kind / `approve_only` / ander gezin → 403.
- WS-broadcast na move (uitbreiding `ws.test.ts` of dedicated case).

### 3. Web — weekgrid met drag-drop

**Plaats**: refactor `WeekOverview.tsx` + nieuw `WeekPlannerGrid.tsx` (of
equivalent) onder `apps/web/app/[locale]/(dashboard)/taken/`.

#### Grid-layout (wijziging t.o.v. Batch 9)

| Was (Batch 9) | Wordt (Batch 12) |
| --- | --- |
| Eén rij, alle kinderen gemengd per dagkolom | **Eén rij per kind** + kolommen ma–zo |
| Klik → taakdefinitie | Klik → taakdefinitie (ongewijzigd) |
| Geen slepen | Drag-handle op verplaatsbare chips |

- Kindfilter (Batch 9) blijft: “heel gezin” toont alle rijen; filter op één kind
  toont één rij.
- Verplaatsbare chips: status `open` of `open_redo` — visueel met
  `cursor-grab` / drag-handle; overige statussen zijn read-only (geen slepen).

#### DnD-bibliotheek

- **`@dnd-kit/core`** + `@dnd-kit/utilities` (toevoegen aan `apps/web`).
- Reden: toegankelijkheid (keyboard), touch-vriendelijk, geen zware dependency.
- Geen native HTML5-DnD alleen — slechte a11y op mobiel.

#### Interactie-flow

1. Ouder begint drag op instance-chip.
2. Drop op cel `(childId, date)` → optimistic UI (chip verplaatst direct).
3. `POST /api/v1/instances/{id}/move` met `Idempotency-Key` + body
   `{ date, childId }`.
4. Succes → state bevestigen; fout → rollback + `Alert` met vriendelijke copy
   (slot bezet / niet meer verplaatsbaar).
5. Dubbelklik-gedrag: niet introduceren; klik blijft taak-edit openen.

#### Realtime

- `useRealtimeRefetch` (Batch 11) op week-tab: bij `instance.updated` →
  debounced refetch van `GET /instances?from=&to=` (300 ms, zelfde patroon als
  Vandaag).
- Optimistic move + inkomende WS-refetch: voorkom flitsen door refetch alleen
  als er geen lopende drag/mutatie is (simpele `isDragging` / `pendingMove` guard).

#### i18n (`nl` + `en`)

Nieuwe keys onder `taken.week`:

| Key | Voorbeeld (nl) |
| --- | --- |
| `dragHint` | Sleep een taak naar een andere dag of een ander kind. |
| `moveError` | Verplaatsen lukte niet. Probeer het nog eens. |
| `slotTaken` | Hier staat al een taak voor dit kind op deze dag. |
| `notMovable` | Deze taak kun je niet meer verplaatsen. |
| `moving` | Bezig met verplaatsen… |

#### Design

- Ouder-register; tokens uit `globals.css` — geen ruwe hex/px.
- Drop-target: subtiele `ring-accent` op hover; geen alarmkleuren.
- Drag-preview: lichte schaduw (`shadow-card`), opacity 0.9.
- `design-system` skill → `/design-check` vóór merge.

### 4. Permissies & privacy

- Pagina blijft achter `RequireFullParent`; `approve_only` ziet week-tab niet.
- API: `full`-only op move-endpoint.
- Log nooit kindnamen, instance-id's met PII, of drag-coördinaten in productie.
- Geen kind-WS; alleen ouder-dashboard.

## Techniek & conventies

- **Architectuurregels**: SQL alleen in repo; mutatie idempotent; geen
  ledger-wijziging bij move; geen negatieve mechaniek.
- **BFF**: bestaande `/api/v1/[...path]` proxy — geen aparte route.
- **Geen migratie**: `UPDATE` op bestaande `task_instances`-rij volstaat.
- **Cron/engine**: `INSERT OR IGNORE` bij dagelijkse generatie voorkomt dat een
  verplaatste instance wordt overschreven; roulatie-engine raakt bestaande rijen
  niet aan.
- **Tests**:
  - API: move happy/conflict/authz/idempotency/WS (zie §2).
  - Shared: `MoveInstanceBody` parse.
  - Web: DnD-drop handler unit-test (mock apiClient); schema-parse;
    optioneel Playwright smoke (sleep chip → andere dag).
- **Handmatige rooktest**:
  1. Open week-tab → sleep taak van di naar do → verschijnt op do (zelfde kind).
  2. Sleep taak van Sam naar Noor op dezelfde dag → kind wijzigt.
  3. Sleep naar bezette cel → foutmelding, grid terug naar vorige staat.
  4. Afgevinkte taak → niet sleepbaar.
  5. Co-ouder A sleept; co-ouder B ziet wijziging live (WS).
  6. Vandaag-tab toont verplaatste instance op nieuwe dag.
  7. `approve_only` op `/taken` → guard (ongewijzigd).
  8. Locale EN: nieuwe copy vertaald.

## Definition of done

- [ ] `MoveInstanceBody` + eventuele foutcode in shared; API-spec §instances bijgewerkt.
- [ ] `moveInstance` repo + `applyMoveInstance` service + DO `/move` + route.
- [ ] Authz-tests: kind, `approve_only`, cross-family → 403.
- [ ] Conflict- en status-tests → 409; idempotentie → replay.
- [ ] WS `instance.updated` na move (met `date` in payload indien toegevoegd).
- [ ] Weekgrid: per-kind rijen + `@dnd-kit` drag-drop.
- [ ] Alleen `open` / `open_redo` sleepbaar; optimistic UI + rollback bij fout.
- [ ] Realtime-refetch op week-tab (Batch 11 hook).
- [ ] nl + en strings compleet.
- [ ] Geen PII in logs.
- [ ] `typecheck` + lint + tests groen; CI groen.
- [ ] Batch 11 is basis (gemerged).

## Acceptatiecriteria (PO-vriendelijk)

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | Sleep open taak naar andere dag | Taak staat op nieuwe dag; Vandaag klopt op die dag |
| 2 | Sleep taak naar ander kind (zelfde dag) | Kind wijzigt; weekgrid toont in juiste rij |
| 3 | Sleep naar bezette cel (zelfde taak+kind+dag) | Vriendelijke fout; grid ongewijzigd |
| 4 | Taak is af / wacht op goedkeuring | Niet sleepbaar |
| 5 | Sleep naar gisteren | Geblokkeerd (API + UI) |
| 6 | Twee ouders op week-tab; één sleept | Ander ziet wijziging zonder handmatig verversen |
| 7 | Netwerkfout tijdens sleep | Chip springt terug; foutmelding |
| 8 | `approve_only` opent `/taken` | Guard-melding, geen week-drag |
| 9 | Locale EN | Drag-hint en foutcopy in het Engels |
| 10 | Idempotente retry (zelfde Idempotency-Key) | Geen dubbele wijziging |

## Beslissingen (review afgerond)

| # | Onderwerp | Beslissing |
| --- | --- | --- |
| 1 | API-vorm | **`POST /instances/{id}/move`** met volledige doel `{ date, childId }` |
| 2 | Verplaatsbare statussen | Alleen **`open`** en **`open_redo`** |
| 3 | Datumgrens | **≥ vandaag** (gezins-timezone); geen verplaatsen naar verleden |
| 4 | Grid-layout | **Per-kind rijen** (niet één gemengde rij) |
| 5 | DnD-lib | **`@dnd-kit/core`** |
| 6 | Ledger | **Geen** puntenwijziging bij move |
| 7 | Realtime | **Ja** — week-tab gebruikt bestaande WS-refetch |
| 8 | Nieuwe instances via drag | **Nee** — alleen bestaande instances verplaatsen |

## Agents / skills bij implementatie

| Onderdeel | Agent / skill |
| --- | --- |
| Move-endpoint, repo, DO, tests | `@taakhelden-backend` |
| Weekgrid DnD, optimistic UI, realtime hook | `@taakhelden-web` |
| `MoveInstanceBody` + foutcodes | `@taakhelden-backend` (klein) |
| API-contract / geen ledger-bijwerking | `@taakhelden-architect` |
| nl/en catalogs | `@taakhelden-i18n` |
| Grid tokens, drag-states | `design-system` skill → `/design-check` |
| Idempotentie, geen SQL in routes | `@architecture-reviewer` |
| Authz `full`-only | `@taakhelden-security` |
| API + web unit-tests | `@taakhelden-tester` |
| Optioneel E2E sleep-scenario | `@taakhelden-e2e` |

## Samenvatting

Batch 12 levert de **weekplanner met drag-and-drop** die product §3.6 belooft: een
nieuw idempotent `POST /instances/{id}/move`-contract in de Worker en een
per-kind weekgrid op `/taken` waar ouders open taken tussen dagen en kinderen
kunnen slepen. Geen ledger-impact, geen migratie. Inzichten en overige
post-MVP-items blijven bewust later.
