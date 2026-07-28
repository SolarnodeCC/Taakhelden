# Web dashboard — Batch 9 plan

Planning voor de negende bouwslag van het ouder-dashboard (`apps/web`). Dit
document is de scope- en aanpakafspraak; de implementatie volgt in een aparte PR
**nadat Batch 8 is gemerged** (Batch 9 bouwt voort op Taken CRUD + route-guards).

## Waar we staan (batch 1–8)

| Batch | Inhoud | Status |
| --- | --- | --- |
| 1–3 | i18n, auth/BFF, app-shell + nav | Done |
| 4 | **Vandaag** + **Goedkeuren** | Done |
| 5 | **Taken** + **Winkel** (basis-CRUD) | Done |
| 6 | **Inzichten** | Stub — Fase 2 |
| 7 | **Registratie** + **Gezin/kinderen** + gezinscode/QR | Done |
| 8 | **Co-ouder** + **gezinsinstellingen** + route-guards | Done |
| **9** | **Taken-verdieping** | Dit plan |

Na Batch 5–8 kan een ouder taken handmatig aanmaken, bewerken en archiveren.
Wat product §3.2 / §3.6 belooft maar de UI nog mist: leeftijdssjablonen, wekelijkse
roulatie tussen kinderen, start-/einddatum van een taak, en een weekoverzicht.

De API is grotendeels klaar: `GET /tasks/templates`, `TaskBody.rotation` /
`activeFrom` / `activeUntil`, en `GET /instances?from=&to=` bestaan al. De
web-formulierpayload (`TaskFormPayload`) stuurt die velden alleen nog niet mee.

## Scope van batch 9 — Taken-verdieping: **Templates** + **Roulatie/data** + **Weekoverzicht**

Batch 9 maakt van `/taken` het volledige taak-commandocentrum voor MVP-setup
(zonder instance-level drag-drop — zie open vraag 2).

1. **Leeftijdssjablonen** — kies kind/leeftijd → `GET /tasks/templates?age=` →
   één tik toevoegen via bestaand `POST /tasks`.
2. **Roulatie + actief-venster** — `rotation`, `activeFrom`, `activeUntil` in
   `TaskForm` / lijst (API + engine bestaan al).
3. **Weekoverzicht** — weekgrid op basis van `GET /instances?from=&to=`
   (read-only of licht interactief; geen cell-drag zonder nieuwe API).

### Waarom deze scope, en niet drag-drop / Inzichten / beschrijving

- **Sluit het Taken-MVP-gat.** Product MVP: “Taken (handmatig + leeftijdstemplates),
  herhalingen”; roulatie staat in §3.2; API-schema dekt het al.
- **Web-first, API-klaar.** Templates, rotation en date windows zijn web-only
  tegen bestaande endpoints — geen Worker-migratie nodig.
- **Weekplanner ≠ instance-move.** Product noemt “weekplanner (drag & drop)”,
  maar er is geen endpoint om een instance van datum/kind te verplaatsen.
  Een read-only (of definitie-gedreven) weekgrid levert planning-inzicht zonder
  API-scope-creep; echte drag-drop → latere batch + nieuw contract.
- **Inzichten** blijft Fase 2 (Batch 6/12).
- **Taakbeschrijving** staat in product §3.2 maar ontbreekt in schema/DB —
  bewust niet in deze batch (schema-wijziging + migratie).

### Afhankelijkheid

```
Batch 8 merged → Branch vanaf main → Batch 9 implementatie-PR
```

Zonder Taken CRUD, `apiClient` patch/delete, `RequireFullParent`, en
`GET /members` (birthYear / kindnamen) is dit plan niet implementeerbaar.

### Buiten scope (volgende batches)

- **Batch 10+**: notificatie-instellingen per kind, ledger/punten-aanpassing,
  AVG-export/verwijdering, realtime WS, Inzichten (Fase 2).
- **Later / apart**: echte drag-drop weekplanner (nieuwe instance-move /
  override-API), rijkere template-catalogus in KV, taak-`description`-veld,
  foto “verplicht” i.p.v. alleen bonuspunten, iOS-pariteit.
- **Niet in deze batch**: soft-delete kind/gezin, SIWA, wachtwoord-vergeten,
  marketing-landing, wijziging van bestaande recurrence-engine-regels.

## Wat we bouwen

### 1. Leeftijdssjablonen (sectie / flow op `/taken`)

- **Instap**: knop *“Uit sjabloon”* / *“Suggesties”* naast *Nieuwe taak*
  (of eerste stap in het create-formulier).
- **Leeftijd kiezen**:
  - Selecteer een kind → bereken leeftijd uit `birthYear`
    (`huidigJaar - birthYear`), of
  - Handmatige leeftijd (fallback als er nog geen kinderen zijn — edge case;
    create blijft sowieso assignees nodig hebben).
- **Laden**: `GET /api/v1/tasks/templates?age={n}` → lijst tonen
  (titel, categorie, punten, eventuele recurrence-hint).
- **Toevoegen**:
  1. Ouder kiest sjabloon + wijst ≥1 kind toe (preselect het gekozen kind).
  2. Optioneel: form openen met prefilled velden (titel/categorie/punten/
     recurrence) zodat ouder nog kan bijsturen vóór opslaan.
  3. `POST /api/v1/tasks` met volledige `TaskBody` — **geen** apart
     apply-template-endpoint nodig.
- **Catalogus**: gebruik de bestaande 8 statische templates in
  `apps/api/src/routes/tasks.ts` (geen KV-migratie). Uitbreiden van de
  catalogus-inhoud = open vraag 3.
- **Dubbele titels**: API blokkeert niet; UI mag waarschuwen maar niet hard
  blokkeren als het gezin het sjabloon opnieuw wil.

### 2. Roulatie + `activeFrom` / `activeUntil` in `TaskForm`

Uitbreiden van `TaskFormPayload` + `TaskForm.tsx` + lijstweergave:

| Veld | UI | Gedrag |
| --- | --- | --- |
| `rotation` | Geordende multi-select (≥2 kinderen) of “Roulatie aan” + volgorde | Optioneel. Als gezet: engine wijst **één kind per ISO-week** toe (`isoWeek % length`). Korte uitleg in ouder-copy. `assignees` blijft verplicht (schema); bij roulatie: zet `assignees` = unieke ids uit `rotation` (of laat ouder beide zien — voorkeur: sync assignees ← rotation). |
| `activeFrom` | `type="date"` | Optioneel. Eenmalige taken / startdatum huiswerk. API zet default “vandaag” bij create als weggelaten. |
| `activeUntil` | `type="date"` | Optioneel. Bijv. toetsdatum; daarna geen nieuwe instances. Validatie: `until ≥ from` als beide gezet. |

**Lijst (`TaskRow`)**: toon compacte badges/labels voor roulatie (kindernamen of
“wisselend”), actief-venster (indien gezet), en eventueel daypart (al in form,
nog niet in list).

**Engine-notitie (geen code-wijziging verwacht):** `PATCH` werkt door op
**toekomstige** instances; bestaande open instances van vandaag wijzigen niet
terugwerkend — UI-copy mag dit kort noemen bij opslaan van recurrence/rotation.

### 3. Weekoverzicht

Doel: ouder ziet in één oogopslag wat er die week gepland staat.

- **Data**: `GET /api/v1/instances?from=YYYY-MM-DD&to=YYYY-MM-DD` (+ optioneel
  `childId`). Paginate via `nextCursor` / `limit` (max 100) tot de week gevuld
  is — families met veel taken kunnen >50 instances/week hebben.
- **UI-voorstel** (afhankelijk van open vraag 2 & 4):
  - Sectie of tab **Week** op `/taken` (geen aparte nav-item tenzij nodig).
  - Grid: kolommen ma–zo (gezin timezone / locale weekstart: **maandag** voor NL).
  - Cellen: instance-titel + kind + status-chip (open / done / pending approval).
  - Navigatie: vorige/volgende week.
  - Klik op cel/titel → bestaande taak bewerken (definitie), **niet** instance
    verplaatsen.
- **Geen drag-drop** in de default scope; dat vereist nieuwe API (open vraag 2).

## Techniek & conventies

- **Datapatroon**: client-component + `apiClient` + Zod, zoals Batch 5–8.
- **Shared / web types**:
  - `TaskFormPayload` uitbreiden met `rotation`, `activeFrom`, `activeUntil`.
  - Templates-response typen (web Zod of shared als die nog ontbreekt).
  - Instance-history response voor weekgrid (spiegel API `instanceView`).
- **BFF**: bestaande `/api/v1/[...path]` — geen nieuwe auth-routes.
- **i18n** (`nl` + `en`): `taken.templates.*`, `taken.form.rotation`,
  `taken.form.activeFrom` / `activeUntil`, `taken.week.*`.
- **Privacy**: log nooit kindnamen, instance-id’s in debug dumps met PII, of
  foto-URLs (regel 5).
- **Design**: ouder-register; primitives `Field` / `Input` / `Button` / `Card` /
  `Alert`. Geen kid-chrome. Tokens, geen ruwe hex. Weekgrid: rustige tabel/grid,
  geen dashboard-stat-strips.
- **Permissie**: pagina blijft achter `RequireFullParent`; mutations al
  `full`-only op de API. `approve_only` ziet weekoverzicht niet (zelfde gate).

## Tests & kwaliteit

- API: templates + task create met rotation/dates bestaan grotendeels —
  web-batch; alleen API-touch als catalogus wordt uitgebreid of een klein
  gat in authz/schema-tests blijkt.
- Web:
  - Schema-tests: uitgebreide `TaskFormPayload` / TaskView-velden,
    templates-response, eventueel instances history parse.
  - Component/logic: leeftijd uit `birthYear`; `until ≥ from`; rotation ≥ 2.
- Handmatige rooktest:
  1. Kind 8 jaar → templates laden → toevoegen → taak in lijst + Vandaag.
  2. Taak met rotation Sam↔Noor → wisselende assignee over twee ISO-weken
     (of via Vandaag na datum-simulatie / weekgrid).
  3. `activeUntil` in het verleden / voor deze week → geen instances meer.
  4. Weekgrid toont instances; klik opent edit-form.
  5. `approve_only` op `/taken` → guard (ongewijzigd).
  6. Locale EN: nieuwe copy vertaald.
- `npm run typecheck` + `lint` + web-tests groen; CI groen.

## Definition of done

- [ ] Ouder kan leeftijdssjablonen laden en als taak toevoegen (met assignees).
- [ ] `rotation`, `activeFrom`, `activeUntil` lezen/schrijven via create/edit;
      zichtbaar in lijst waar relevant.
- [ ] Weekoverzicht toont instances voor een gekozen week (afgesproken variant
      uit review).
- [ ] Geen instance-drag-drop tenzij review dat expliciet in-scope zet **en**
      er API-werk bij hoort.
- [ ] nl + en strings compleet; kalme ouder-copy.
- [ ] Geen PII in logs.
- [ ] `typecheck` + lint groen; CI groen.
- [ ] Batch 8 is basis (gemerged).

## Acceptatiecriteria (PO-vriendelijk)

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | Ouder kiest kind (leeftijd 8) → sjablonen | Lijst met passende templates (API-filter) |
| 2 | Sjabloon “toevoegen” + kind toegewezen | Taak in `/taken`; verschijnt op Vandaag indien actief vandaag |
| 3 | Roulatie Sam → Noor aan | Wekelijkse wissel volgens engine; UI toont roulatie-hint |
| 4 | `activeUntil` vóór deze week | Taak niet meer in weekgrid / geen nieuwe instances |
| 5 | Weekoverzicht huidige week | Instances zichtbaar per dag; status herkenbaar |
| 6 | Klik vanuit week op taak | Opent bestaande edit-flow (definitie) |
| 7 | `approve_only` opent `/taken` | Guard-melding, geen CRUD/week |
| 8 | Locale EN | Alle nieuwe copy in het Engels |

## Open vragen voor review

1. **Akkoord met scope** Templates + roulatie/data-venster + weekoverzicht op
   `/taken`, zonder taakbeschrijving-veld en zonder Inzichten?
2. **Weekplanner-diepte**:
   - **A (voorstel):** read-only weekgrid + klik → taakdefinitie bewerken;
     drag-drop instance-move → Batch 10+ (nieuwe API).
   - **B:** weekoverzicht helemaal uitstellen; Batch 9 alleen templates +
     rotation + dates.
   - **C:** echte drag-drop meenemen (vereist API-ontwerp + Worker-werk in
     dezelfde of gekoppelde PR).
3. **Template-catalogus**: bestaande **8** templates laten staan, of in deze
   batch de inhoud uitbreiden richting product §3.2 (meer taken per
   leeftijdsband) in `tasks.ts`? Voorstel: **8 laten** + ticket voor content.
4. **Weekgrid-filter**: default **heel gezin**, met optionele kind-tabs/filter?
   Of standalone per-kind-first?
5. **Week-UI-plaats**: sectie/tab op bestaande `/taken`, of aparte route
   `/week` + nav-item (`requiresFull`)? Voorstel: **tab/sectie op `/taken`**
   (geen nav-groei).

## Agents / skills bij implementatie

| Onderdeel | Agent / skill |
| --- | --- |
| `/taken` form, templates, weekgrid | `@taakhelden-web` |
| Templates/rotation copy (ouder) | `@taakhelden-product-owner` |
| nl/en | `@taakhelden-i18n` |
| Design tokens / weekgrid layout | `design-system` skill → `/design-check` |
| Geen SQL in routes; idempotency bij POST | `@architecture-reviewer` |
| Authz `full` onmutations (spot-check) | `@taakhelden-security` |
| Tests | `@taakhelden-tester` |
| Alleen bij keuze C (drag-drop API) | `@taakhelden-architect` + `@taakhelden-backend` |

## Samenvatting

Batch 9 maakt Taken af voor MVP-setup: sjablonen om snel te starten, roulatie en
datavensters die de API al snapt, en een weekoverzicht zodat ouders het plan
zien. Echte drag-and-drop planning blijft bewust een latere stap tot er een
instance-move-contract is.
