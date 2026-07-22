# Web dashboard — Batch 4 plan

Planning voor de vierde bouwslag van het ouder-dashboard (`apps/web`). Dit
document is de scope- en aanpakafspraak; de implementatie volgt in een aparte PR.

## Waar we staan (batch 1–3)

| Batch | Inhoud | Commit |
| --- | --- | --- |
| 1 | Tweetalige (nl/en) i18n-fundering op de dashboard-scaffold | `3369c13` |
| 2 | Ouder-auth + API-client foundation (BFF, JWT, cookies) | `4056163` |
| 3 | Geauthenticeerde app-shell + design-system + navigatie | `9ecd8c6` |

Op dit moment zijn **alle vijf de secties nog `SectionStub`** — de shell, nav,
permissiegating (`requiresFull`) en de "Binnenkort"-teksten staan, maar er is
nog geen echte data of interactie. De API (`apps/api`) is daarentegen volledig:
alle endpoints die het dashboard nodig heeft bestaan al.

## Scope van batch 4 — de dagelijkse kernlus: **Vandaag** + **Goedkeuren**

Batch 4 maakt de twee secties functioneel die elke ouder dagelijks gebruikt en
die de kern van het product vormen. Dit volgt exact de prioriteitsvolgorde van
het productvoorstel §4 (regels 80–83):

1. **Vandaag-overzicht per kind** — wat staat open, wat is af, wat wacht op
   goedkeuring.
2. **Goedkeuringswachtrij (met foto's)** — één tik goedkeuren of opnieuw laten
   doen.

### Waarom deze twee, en niet Taken/Winkel/Inzichten

- **Hoogste dagelijkse waarde.** Dit is de lus die het gezin elke dag draait;
  taak-/beloningsbeheer doe je zelden, inzichten bekijk je af en toe.
- **Werkt voor élke ouder.** Beide secties staan op `requiresFull: false`, dus
  ook een `approve_only`-verzorger (opa/oma, oppas) heeft er direct wat aan.
  Taken en Winkel zijn `requiresFull: true`.
- **Minimale nieuwe client-oppervlakte.** De acties zijn `GET` + `POST`
  (`/approve`, `/redo`), die de `apiClient` al ondersteunt. Taken/Winkel hebben
  eerst `PATCH`/`DELETE` in de client nodig (zie batch 5).
- **Zelfstandig te verschepen.** Geen afhankelijkheid van de zwaardere CRUD- en
  weekplanner-features.

Dit laat één nieuw, afgebakend technisch onderwerp over: **foto's tonen** via de
presigned-flow.

### Buiten scope (volgende batches)

- **Batch 5 — Taken + Winkel**: taak- en beloningsbeheer (CRUD), inwissel­
  verzoeken, weekplanner (drag & drop). Vereist `PATCH`/`DELETE` in `apiClient`.
- **Batch 6 — Inzichten**: weektrends, verdiend vs. uitgegeven, welke taken
  blijven liggen — *als gesprekshulp, nooit als surveillance* (§4, regel 83).

## Wat we bouwen

### 1. Vandaag (`app/[locale]/(dashboard)/vandaag/page.tsx`)

Vervangt de stub door een overzicht per kind.

- **Data**: `GET /api/v1/instances/today`. Voor een ouder levert dit
  `{ date, children: [{ childId, displayName, avatarId, instances[], balance }] }`
  (zie `apps/api/src/routes/instances.ts:58-71`).
- **UI**: één kaart per kind met naam/avatar en het puntensaldo, en daaronder de
  taken gegroepeerd op status: **open**, **ingediend/wacht op goedkeuring**,
  **goedgekeurd (af)**. Statuslabels positief formuleren (stijlgids §3.7) —
  nooit rode kruisen of schuldtaal.
- **Leeg-staat**: vriendelijke "nog niets voor vandaag" i.p.v. lege lijst.
- **Read-only**: acties gebeuren op Goedkeuren; Vandaag is puur overzicht.

### 2. Goedkeuren (`app/[locale]/(dashboard)/goedkeuren/page.tsx`)

Vervangt de stub door de goedkeuringswachtrij.

- **Data**: de instances met status "ingediend" uit `GET /instances/today`
  (gefilterd), inclusief eventuele `photoId`/`photo_ref`.
- **Foto's**: presigned GET-flow (§3.6 / `apps/api/src/routes/photos.ts`). Foto
  pas ophalen wanneer de kaart in beeld is; EXIF is server-side al gestript.
- **Acties per item**:
  - **Goedkeuren** → `POST /api/v1/instances/:id/approve` (idempotent).
  - **Opnieuw** → `POST /api/v1/instances/:id/redo` met **verplichte**
    vriendelijke `note` ("Bijna! Nog even dit: …"). **Geen puntenaftrek**
    (architectuurregel 4 / §3.3). Kleine invoer-prompt voor de note.
- **Optimistische update**: item verdwijnt uit de wachtrij na de actie; bij fout
  terugrollen met een nette melding.
- **Leeg-staat**: "Alles is bijgewerkt 🎉".

## Techniek & conventies

- **Datapatroon**: client-component + `useEffect` + `apiClient` + Zod-parse,
  precies zoals `AppShell.tsx` het al doet. Geen directe Worker-calls; alles
  loopt via de same-origin BFF (`/api/v1/[...path]`).
- **Nieuwe view-schemas**: voeg `InstanceView`, `TodayView` (en waar nodig een
  foto-URL-response) toe aan `apps/web/lib/api/types.ts`, gemodelleerd naar de
  inline API-responses, met `.passthrough()` voor nog-ongebruikte velden. (De
  API exporteert deze shapes niet uit `@taakhelden/shared`; we spiegelen ze
  web-side, consistent met batch 3.)
- **`apiClient`**: `get` + `post` volstaan; geen uitbreiding nodig deze batch.
- **i18n**: `sections.vandaag` / `sections.goedkeuren` "Binnenkort"-teksten
  vervangen door echte strings in `messages/nl.json` **en** `messages/en.json`
  (statuslabels, knoppen, note-placeholder, leeg-staten). Kindgerichte/statustaal
  altijd positief.
- **Idempotentie**: `apiClient.post` genereert/stuurt een `Idempotency-Key` waar
  de API die vereist; controleren of dit al gebeurt en anders per-actie een sleutel
  meegeven (dubbel goedkeuren mag nooit dubbel effect hebben — architectuurregel 2).
- **Permissies**: beide secties zijn zichtbaar voor `full` én `approve_only`;
  geen extra gating nodig, maar de acties bestaan al server-side onder
  `requireParent`.

## Tests & kwaliteit

- **API-authz-tests bestaan al** voor approve/redo; deze batch is web-only, dus
  geen nieuwe migraties en (naar verwachting) geen API-wijziging. Mocht een
  read-shape ontbreken, dan komt die met een shared-schema + authz-test (workflow-regel).
- `npm run typecheck` groen over alle workspaces.
- Handmatige rooktest: inloggen → Vandaag toont kinderen + saldo → een ingediende
  taak goedkeuren en opnieuw laten doen, met foto zichtbaar.

## Definition of done

- [ ] Vandaag toont per kind saldo + taken gegroepeerd op status (read-only).
- [ ] Goedkeuren toont de wachtrij met foto's; goedkeuren en opnieuw (met note) werken.
- [ ] Geen puntenaftrek bij "opnieuw"; acties idempotent.
- [ ] nl + en strings compleet en positief geformuleerd; geen stub-teksten meer.
- [ ] `npm run typecheck` groen; CI groen.
- [ ] Geen namen/foto-URLs gelogd (privacyregel 5).

## Open vraag voor review

- Akkoord met de scope **Vandaag + Goedkeuren** voor batch 4, met Taken/Winkel
  naar batch 5 en Inzichten naar batch 6? Alternatief is Vandaag + Goedkeuren
  splitsen over twee batches als we de foto-flow apart willen houden.
