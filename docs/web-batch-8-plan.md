# Web dashboard — Batch 8 plan

Planning voor de achtste bouwslag van het ouder-dashboard (`apps/web`). Dit
document is de scope- en aanpakafspraak; de implementatie volgt in een aparte PR
**nadat Batch 7 is gemerged** (Batch 8 bouwt voort op `/gezin`).

## Waar we staan (batch 1–7)

| Batch | Inhoud | Status |
| --- | --- | --- |
| 1–3 | i18n, auth/BFF, app-shell + nav | Done |
| 4 | **Vandaag** + **Goedkeuren** | Done |
| 5 | **Taken** + **Winkel** | Done |
| 6 | **Inzichten** | Stub — Fase 2 |
| 7 | **Registratie** + **Gezin/kinderen** + gezinscode/QR | PR / merge pending |
| **8** | **Co-ouder** + **gezinsinstellingen** + route-guards | Dit plan |

Na Batch 7 kan een nieuw gezin starten en kindertoestellen koppelen. Wat nog
ontbreekt voor gedeeld ouderbeheer: een tweede verzorger uitnodigen, de
uitnodiging accepteren, en gezinsbrede instellingen (bonussen, bedtijd,
vakantie) wijzigen. De API is hiervoor al klaar.

## Scope van batch 8 — gedeeld beheer: **Co-ouder** + **Gezinsinstellingen**

Batch 8 maakt van `/gezin` het volledige ouder-commandocentrum voor
gezinsconfiguratie (zonder notificatie-per-kind — dat is Batch 10+).

1. **Tweede ouder/verzorger uitnodigen** — e-mail + rol (`full` / `approve_only`).
2. **Uitnodiging accepteren** — publieke pagina `/uitnodiging?token=…`.
3. **Gezinsinstellingen** — naam, timezone, quiet hours, dag-/weekbonus, vakantie.
4. **Route-guards** — `approve_only` mag Taken/Winkel/Gezin niet via URL bereiken
   (nu alleen nav-verborgen; Gezin heeft al een client-guard sinds Batch 7).

### Waarom deze scope, en niet notificaties / Inzichten / soft-delete

- **Sluit het gedeelde-beheer-gat.** Product §3.1 belooft co-ouders; API + e-mail
  bestaan al (`POST /families/me/parents`, accept, `APP_BASE_URL/uitnodiging`).
- **Instellingen horen bij Gezin.** Zelfde `full`-gate, zelfde pagina — geen
  aparte `/instellingen`-nav tot er meer secties zijn (notificaties, account).
- **Route-guards zijn goedkoop en blokkeren verwarring.** `approve_only` ziet
  anders lege/foutende CRUD-pagina’s.
- **Notificatie-settings per kind** raken push-copy en kind-UX — Batch 10+.
- **Inzichten** blijft Fase 2 (Batch 6/12).

### Afhankelijkheid

```
Batch 7 merged → Branch vanaf main → Batch 8 implementatie-PR
```

Zonder `/gezin`, `FamilyView.inviteCode`, en het Batch-7-nav-item is dit plan
niet implementeerbaar. Accepteer-pagina (`/uitnodiging`) kan technisch eerder,
maar uitnodigen UI leeft op `/gezin`.

### Buiten scope (volgende batches)

- **Batch 9 — Taken-verdieping**: templates, weekplanner, `rotation` /
  `activeFrom` / `activeUntil`.
- **Batch 10+**: notificatie-instellingen per kind, ledger/punten-aanpassing,
  AVG-export/verwijdering, realtime WS, Inzichten (Fase 2).
- **Niet in deze batch**: SIWA, wachtwoord-vergeten, soft-delete kind/gezin,
  device-sessions revoke, kind-login op web, marketing-landing, wijziging van
  eigen ouder-wachtwoord, herroepen van een pending invite (API heeft geen
  cancel-endpoint — token verloopt na 7 dagen).

## Wat we bouwen

### 1. Co-ouder uitnodigen (uitbreiding `/gezin`)

Onder de bestaande sectie **Ouders & verzorgers** (Batch 7: read-only lijst):

- **Formulier** (alleen `full`):
  - `email` (required)
  - `permissions`: radio/select — `approve_only` (default) | `full`
  - Korte uitleg: *“Alleen goedkeuren”* = Vandaag + Goedkeuren;
    *“Volledig beheer”* = ook Taken/Winkel/Gezin.
- **Actie** → `POST /api/v1/families/me/parents` met `InviteParentBody`
  (`email`, `permissions`).
- **Na succes**:
  - Toon bevestiging (kalme ouder-copy).
  - Response bevat `inviteToken` — **altijd tonen met kopieer-knop**, omdat
    e-mail lokaal/prod zonder mail-secrets een no-op is. Copy: “Deel deze link
    als de mail niet aankomt” + link
    `{origin}/{locale}/uitnodiging?token=…` (of relatief `/uitnodiging?token=`).
  - Lijst van ouders verversen (`GET /members`): nieuwe pending parent verschijnt
    (geen wachtwoord tot accept; displayName is vaak het lokale deel van e-mail).
- **Foutcodes** (i18n): `EMAIL_IN_USE`, `VALIDATION_FAILED`, `FORBIDDEN`,
  generic.
- **Geen** heruitnodigen-API — ouder kan opnieuw uitnodigen alleen als e-mail
  vrij is; verlopen token = nieuwe invite met zelfde e-mail nadat pending is
  opgeruimd (huidig API-gedrag respecteren; geen Worker-wijziging tenzij tests
  een gat tonen).

### 2. Uitnodiging accepteren (`app/[locale]/uitnodiging/page.tsx`)

Publieke pagina (niet in dashboard-layout), parallel aan `/login` / `/register`.

- **URL**: `/uitnodiging?token=…` — moet matchen met
  `sendParentInvite` → `${APP_BASE_URL}/uitnodiging?token=…`.
  Let op: web heeft locale-prefix (`/nl/uitnodiging` of `/en/…`). Opties:
  1. **Aanbevolen**: e-mail-link wijst naar `APP_BASE_URL` **zonder** locale;
     middleware/`next-intl` redirect `/uitnodiging` → `/nl/uitnodiging` (of
     Accept-Language). Controleer of huidige middleware dat al doet voor
     onbekende paths; zo niet: rewrite/redirect toevoegen.
  2. Alternatief: `APP_BASE_URL` in de API zetten op `https://…/nl` — breekbaar.
  3. Alternatief: API-mail aanpassen naar `…/nl/uitnodiging` — vereist API-PR.
- **Velden** (`ParentAcceptBody`):
  - `token` — uit query (hidden/read-only in form)
  - `password` (min. **8** — let op: register vereist 10)
  - `displayName` (optioneel, 1–30)
- **BFF**: nieuw `POST /api/auth/accept-parent` (publiek, zoals login/register):
  1. Valideer `ParentAcceptBody`.
  2. Forward naar Worker `POST /families/parents/accept` (**niet** via
     `/api/v1/*` — die proxy eist cookies).
  3. Parse `ParentSessionResult` / `TokenPair`.
  4. `setTokens(...)`.
  5. `{ ok: true }`.
- **Na succes**: redirect `/vandaag` (geen kind-onboarding — gezin bestaat al).
- **Foutcodes**: `INVALID_INVITE`, `VALIDATION_FAILED`, generic. Copy: “Deze
  uitnodiging is verlopen of al gebruikt — vraag de andere ouder om een nieuwe.”
- **Lege/ontbrekende token**: vriendelijke fout + link naar login.
- **Al ingelogd**: uitloggen of waarschuwen? Voorstel: sessie overschrijven met
  de nieuwe tokens (simpelst); open vraag hieronder.

### 3. Gezinsinstellingen (sectie op `/gezin`)

Nieuwe sectie **Instellingen** op dezelfde pagina (onder gezinscode / boven of
onder kinderen — voorstel: na gezinscode, vóór kinderen).

- **Data**: velden uit `GET /families/me` die Batch 7 nog negeert — typeer ze in
  `FamilyView`:
  - `name`, `timezone`
  - `quietStart`, `quietEnd` (`HH:MM`)
  - `dayBonusPoints`, `weekBonusPoints`, `weekBonusThreshold` (0.5–1)
  - `vacationMode` (boolean)
- **Formulier** → `PATCH /api/v1/families/me` (`FamilyPatchBody`, partial ok;
  stuur gewijzigde of alle zichtbare velden).
- **UI-notities**:
  - Timezone: select met gangbare IANA-zones (minimaal `Europe/Amsterdam` +
    een korte allowlist NL/BE/DE/…); geen vrije tekst zonder validatie.
  - Quiet hours: twee `type="time"` inputs → `HH:MM`.
  - Bonussen: number inputs (≥0); threshold als percentage 50–100% in UI,
    opslaan als 0.5–1.
  - Vakantiemodus: checkbox + korte uitleg (“pauzes streaks en bonussen” —
    streaks UI komt later, maar de flag bestaat al in de API).
  - Gezinsnaam: zelfde veld als register; sync shell-header na save
    (herlaad family of lift state).
- **Permissie**: alleen `full` (pagina is al gated).

### 4. Route-guards voor `approve_only`

Herbruik het Batch-7-patroon van `/gezin`:

| Route | Guard |
| --- | --- |
| `/gezin` | Bestaat (Batch 7) — behouden |
| `/taken` | Toevoegen: session `!== "full"` → melding + link `/vandaag` |
| `/winkel` | Idem |

Voorstel: kleine gedeelde helper/hook `useRequireFullParent()` in
`apps/web/lib/auth/` of component `RequireFullParent`, zodat de drie pagina’s
niet divergeren. Server-side redirect in `page.tsx` is optioneel (session zit
in cookies; kan via `GET /api/session` in een server component) — client-guard
zoals Gezin is voldoende voor deze batch als consistent.

## Techniek & conventies

- **Datapatroon**: client-component + `apiClient` + Zod, zoals Batch 5–7.
- **Shared schemas**: `InviteParentBody`, `ParentAcceptBody`, `FamilyPatchBody`,
  `ParentSessionResult` uit `@taakhelden/shared`.
- **BFF**:
  - `POST /api/auth/accept-parent` — cookie-schrijven (nieuw).
  - Uitnodigen + settings via bestaande `/api/v1/[...path]`.
- **`apiClient`**: `get` / `post` / `patch` — geen DELETE.
- **i18n** (`nl` + `en`):
  - `gezin.inviteParent.*`, `gezin.settings.*` (uitbreiden bestaande `gezin`)
  - `auth.accept.*` (nieuwe namespace voor `/uitnodiging`)
  - `guards.forbidden` of hergebruik `gezin.forbidden` voor Taken/Winkel
- **Privacy**: log nooit e-mailadressen, invite tokens, of tokens in client
  `console` (architectuurregel 5).
- **Design**: ouder-register; primitives `Field`/`Input`/`Button`/`Card`/`Alert`.
  Geen kid-chrome. Tokens, geen ruwe hex.
- **E-mail / locale**: zie open vraag 2 — middleware-redirect is de voorkeur
  zodat de API-mail-URL (`/uitnodiging?token=`) blijft werken.

## Tests & kwaliteit

- API-tests voor parents/accept/settings bestaan al (`parents.test.ts`, e.d.) —
  web-only batch tenzij locale-redirect een kleine API/mail-aanpassing vraagt.
- Web:
  - Schema-tests: `FamilyPatchBody`, `InviteParentBody`, `ParentAcceptBody`
    parse (uitbreiding `types.test.ts`).
  - Optioneel: BFF accept-parent happy path met gemockte `fetch`.
- Handmatige rooktest:
  1. Full parent op `/gezin` → nodig tweede ouder → token/link zichtbaar.
  2. Incognito `/uitnodiging?token=…` → wachtwoord zetten → land op Vandaag.
  3. `approve_only` login → Gezin/Taken/Winkel niet in nav; directe URL → guard.
  4. Instellingen wijzigen (naam, quiet hours, vakantie) → herlaad → waarden
     blijven; shell toont nieuwe gezinsnaam.
  5. `EMAIL_IN_USE` bij dubbele invite.
- `npm run typecheck` + `lint` + web-tests groen; CI groen.

## Definition of done

- [ ] Full parent kan co-ouder uitnodigen (e-mail + rol); token/link zichtbaar.
- [ ] Publieke `/uitnodiging` accepteert token + wachtwoord; cookies gezet;
      redirect Vandaag.
- [ ] Gezinsinstellingen (naam, timezone, quiet hours, bonussen, vakantie)
      lezen en opslaan via `PATCH /families/me`.
- [ ] `approve_only` geblocked op `/taken`, `/winkel`, `/gezin` (niet alleen nav).
- [ ] nl + en strings compleet; kalme ouder-copy.
- [ ] Geen PII/tokens in logs.
- [ ] `typecheck` + lint groen; CI groen.
- [ ] Batch 7 is basis (gemerged of stacked branch).

## Acceptatiecriteria (PO-vriendelijk)

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | Full parent nodigt opa uit als `approve_only` | 201; token/link toonbaar; opa in ledenlijst |
| 2 | Opa opent link, kiest wachtwoord | Ingelogd; ziet Vandaag + Goedkeuren; geen Taken/Winkel/Gezin |
| 3 | Verlopen/ongeldige token | Duidelijke `INVALID_INVITE`-melding |
| 4 | Invite met bestaand e-mailadres | `EMAIL_IN_USE` |
| 5 | Quiet hours + vakantie opslaan | Waarden blijven na refresh |
| 6 | `approve_only` opent `/taken` | Guard-melding, geen CRUD |
| 7 | Locale EN | Alle nieuwe copy in het Engels |

## Open vragen voor review

1. **Akkoord met scope** Co-ouder + gezinsinstellingen + route-guards op
   `/gezin` / `/uitnodiging`, zonder aparte `/instellingen`-nav?
2. **Locale in uitnodigingsmail**: middleware-redirect `/uitnodiging` →
   `/nl/uitnodiging` (voorstel) vs. API-mail aanpassen naar locale-pad?
3. **Pending invite opnieuw tonen**: alleen direct na create (token eenmalig in
   UI), of token nergens bewaren en alleen “mail verstuurd” tonen? Voorstel:
   **toon token/link altijd na create** (dev + prod zonder mail).
4. **Al ingelogd op `/uitnodiging`**: sessie overschrijven (voorstel) vs.
   eerst uitloggen eisen?
5. **Timezone-lijst**: korte allowlist (NL-focus) of volledige IANA? Voorstel:
   korte allowlist + default `Europe/Amsterdam`.

## Agents / skills bij implementatie

| Onderdeel | Agent / skill |
| --- | --- |
| `/gezin` secties, accept-pagina, guards | `@taakhelden-web` |
| BFF accept-parent, authz | `@taakhelden-security` |
| nl/en | `@taakhelden-i18n` |
| Rollen-copy (`full` vs `approve_only`) | `@taakhelden-product-owner` |
| Design tokens / primitives | `design-system` skill → `/design-check` |
| Route-guard hergebruik | `@architecture-reviewer` |
| Tests | `@taakhelden-tester` |

## Samenvatting

Batch 8 maakt gedeeld ouderbeheer af: uitnodigen, accepteren, gezinsinstellingen,
en eerlijke route-guards voor `approve_only`. Alles leunt op bestaande API’s;
nieuw is vooral web-UI + één publieke BFF-route. Notificaties, privacy-export en
Inzichten blijven bewust later.
