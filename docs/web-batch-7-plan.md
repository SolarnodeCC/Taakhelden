# Web dashboard — Batch 7 plan

Planning voor de zevende bouwslag van het ouder-dashboard (`apps/web`). Dit
document is de scope- en aanpakafspraak; de implementatie volgt in een aparte PR.

## Waar we staan (batch 1–6)

| Batch | Inhoud | Status |
| --- | --- | --- |
| 1 | Tweetalige (nl/en) i18n-fundering op de dashboard-scaffold | Done |
| 2 | Ouder-auth + API-client foundation (BFF, JWT, cookies) | Done |
| 3 | Geauthenticeerde app-shell + design-system + navigatie | Done |
| 4 | **Vandaag** + **Goedkeuren** (dagelijkse kernlus, foto-flow) | Done |
| 5 | **Taken** + **Winkel** (CRUD, inwisselverzoeken) | Done |
| 6 | **Inzichten** | Nog stub (`SectionStub`) — Fase 2 |

De dagelijkse ouder-lus en taak-/beloningsbeheer werken. Wat nog ontbreekt voor
een compleet MVP-dashboard is **hoe een nieuw gezin überhaupt binnenkomt** en
**hoe kindprofielen + gezinscode beheerd worden**. De API (`apps/api`) is daar
al klaar voor: register, members/children, invite-code, pincode — geen nieuwe
Worker-endpoints nodig.

## Scope van batch 7 — onboarding end-to-end: **Registratie** + **Gezin & kinderen**

Batch 7 sluit de gap tussen “ik heb een account” en “mijn kind kan de iOS-app
koppelen”. Zonder deze batch blijft het dashboard alleen bruikbaar voor gezinnen
die elders (iOS of handmatig) zijn aangemaakt. Dit volgt productvoorstel §3.1
(onboarding & accounts) en de web-prioriteit: ouder = command center.

1. **Ouder-registratie** — e-mail + wachtwoord + Turnstile → gezin + sessie.
2. **Kindprofielen beheren** — aanmaken / bewerken / pincode resetten.
3. **Gezinscode tonen + hergenereren** — zodat het kindertoestel kan koppelen.

### Waarom deze drie, en niet Instellingen / Co-ouder / Inzichten

- **Blokkeert end-to-end.** Zonder registratie + kind + gezinscode kan een
  nieuw gezin het product niet zelfstandig starten op web. Co-ouder-uitnodiging
  en gezinsinstellingen (bonussen, bedtijd) zijn belangrijk, maar niet
  blocker voor “eerste kind koppelt iOS”.
- **API is 100% klaar.** Alle mutaties bestaan al; dit is web-UI + één nieuwe
  BFF-route (`POST /api/auth/register`), analog aan login.
- **Zelfstandig te verschepen.** Geen afhankelijkheid van Inzichten (Fase 2),
  weekplanner, of realtime WS.
- **Past bij iOS-split.** Kind-pairing UI (code intypen, PIN, Face ID) blijft
  iOS; web toont alleen de code/QR en beheert de kindprofielen — zie
  iOS-bouwvoorstel en product §4.2.

### Buiten scope (volgende batches)

- **Batch 8 — Co-ouder + Instellingen**: tweede verzorger uitnodigen/accepteren,
  gezinsnaam/timezone/bonussen/quietHours/vakantiemodus, route-guards voor
  `approve_only`.
- **Batch 9 — Taken-verdieping**: leeftijdstemplates, weekplanner,
  `rotation`/`activeFrom`/`activeUntil` in de UI.
- **Batch 10+**: notificatie-instellingen, ledger/punten-aanpassing, AVG-export,
  realtime, Inzichten (Fase 2).
- **Niet in deze batch**: Sign in with Apple op web, wachtwoord-vergeten,
  kind-profielfoto-upload (presigned), soft-delete kindprofiel UI,
  device-sessions revoke, kind-login op web, marketing-landing.

## Wat we bouwen

### 1. Registratie (`app/[locale]/register/page.tsx`)

Nieuwe publieke pagina naast `/login`.

- **Velden** (uit `RegisterBody` in `@taakhelden/shared`):
  - `email`
  - `password` (min. 10 tekens; client + server)
  - `familyName` (1–50) — “Naam van je gezin”
  - `displayName` (1–30) — “Jouw roepnaam”
  - `turnstileToken` — Cloudflare Turnstile widget
- **BFF**: nieuw `POST /api/auth/register` — spiegelt
  `apps/web/app/api/auth/login/route.ts`:
  1. Valideer body met `RegisterBody`.
  2. Forward naar Worker `POST /auth/register`.
  3. Parse `ParentSessionResult` / `TokenPair`.
  4. `setTokens(...)` → httpOnly cookies.
  5. Antwoord `{ ok: true }`.
- **Na succes**: redirect naar onboarding-stap **Kind toevoegen**
  (`/gezin?onboarding=1` of `/onboarding/kind`) — niet rechtstreeks naar
  `/vandaag` (dat is leeg zonder kinderen).
- **Foutcodes** (i18n): `EMAIL_IN_USE`, `VALIDATION_FAILED`, `RATE_LIMITED`,
  generic. Positieve, behulpzame toon (geen schuldtaal).
- **Login-pagina**: link “Nog geen account? Start je gezin” → `/register`.
  Register-pagina: link terug naar login.
- **Turnstile**:
  - Site key via env (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`).
  - Lokaal: Worker accepteert elk token als `TURNSTILE_SECRET` ontbreekt;
    token blijft verplicht in de body (bijv. `"dev-bypass"` in development).
  - Widget alleen op register (login heeft géén Turnstile in `LoginBody`).

### 2. Gezin & kinderen (`app/[locale]/(dashboard)/gezin/page.tsx`)

Nieuwe dashboard-sectie in de navigatie.

- **Nav**: voeg toe aan `nav.ts`:

  ```ts
  { key: "gezin", href: "/gezin", requiresFull: true }
  ```

  Plaats tussen **Winkel** en **Inzichten** (beheer, niet dagelijkse lus).
  Alleen zichtbaar voor `full` parents — `approve_only` beheert geen kinderen.

- **Data**:
  - `GET /api/v1/families/me` — toon `name` + **`inviteCode`** (nu negeert de
    shell dit veld).
  - `GET /api/v1/members` — filter `role === "child"` voor de kindlijst;
    toon ook ouders read-only (roepnaam + rol) ter context.

#### 2a. Gezinscode-kaart

- Grote, goed leesbare **6-cijferige code** (`inviteCode`).
- **Kopiëren** naar klembord + korte bevestiging.
- Optioneel: **QR-code** gegenereerd client-side uit de code-string
  (geen API nodig; bibliotheek licht houden, bijv. `qrcode` of SVG-lib).
  Als QR te zwaar voelt voor de PR: code + kopiëren is MVP; QR als
  follow-up in dezelfde batch als het meevalt.
- Korte ouder-copy: “Open de TaakHelden-app op het kindertoestel en vul
  deze code in.” — géén kindgerichte UI hier.
- Actie **Nieuwe code maken** → `POST /api/v1/families/me/invite-code`
  (idempotent via `apiClient`). Bevestigingsdialoog: “De oude code werkt
  meteen niet meer.” Toon nieuwe code na succes.

#### 2b. Kindlijst

Per kind: roepnaam, geboortejaar, afgeleide leeftijdsmodus (`ageMode`:
young/mid/teen), avatar-placeholder.

Acties (`requiresFull` — API weigert anders met `FORBIDDEN`):

| Actie | Endpoint | UI |
| --- | --- | --- |
| Kind toevoegen | `POST /members/children` | Formulier / dialoog |
| Bewerken | `PATCH /members/{id}` | Inline of dialoog (`displayName`, `birthYear`, `avatarId`) |
| Pincode resetten | `POST /members/{id}/pincode` | Dialoog: nieuwe 4-cijferige PIN + bevestiging |

**Leeg-staat**: vriendelijk “Nog geen kinderen — voeg het eerste kind toe”
+ primaire CTA. Dit is ook de onboarding-landing na registratie.

#### 2c. Kind aanmaken — formulier

Velden uit `CreateChildBody`:

| Veld | Validatie | UI-notities |
| --- | --- | --- |
| `displayName` | 1–30 | “Roepnaam” |
| `birthYear` | int, min 2005, max (huidig jaar − 3) | Jaarkiezer, geen volledige geboortedatum (privacy) |
| `avatarId` | optioneel | Eenvoudige vaste set placeholders (emoji/id’s) tot de echte avatar-bibliotheek er is; mag weggelaten worden |
| `pincode` | `/^\d{4}$/` | Twee velden: PIN + bevestiging; nooit in logs |

**AVG-toestemming (art. 8):**

- De API legt `consent_by` + `consent_at` vast bij create — **geen apart
  body-veld**.
- De UI toont wél een expliciete checkbox: “Ik ben ouder/verzorger en geef
  toestemming om dit kindprofiel aan te maken.” Submit disabled tot
  aangevinkt. Dit is client-side UX; de server-consent blijft de bron van
  waarheid.
- Korte link/tekst naar privacy (placeholder-URL ok tot de publieke
  privacyverklaring live is).

**Geen** kind-e-mail, telefoon, of volledige geboortedatum — data-minimization.

#### 2d. Onboarding-flow na registratie

Minimale wizard, geen aparte multi-page stack als dat overkill is:

1. Register → cookies gezet.
2. Redirect naar `/gezin?onboarding=1`.
3. Banner/stappenindicator: “Stap 2 — Voeg je eerste kind toe”.
4. Na succesvol kind: banner wordt “Stap 3 — Deel de gezinscode met het
   kindertoestel” en scroll/focus naar de code-kaart.
5. CTA “Naar vandaag” → `/vandaag` wanneer minstens één kind bestaat.

Geen aparte `/onboarding/*`-routes tenzij de UX dat eist tijdens
implementatie; query-param + conditional UI op `/gezin` houdt de
oppervlakte klein (consistent met batch-4-filosofie).

## Techniek & conventies

- **Datapatroon**: client-component + `useEffect`/`apiClient` + Zod-parse,
  zoals `TakenClient` / `WinkelClient` / `AppShell`. Alles via same-origin
  BFF; geen directe Worker-calls vanuit de browser.
- **Shared schemas prefereren**: importeer `RegisterBody`, `CreateChildBody`,
  `UpdateMemberBody`, `PincodeBody`, `ParentFamilyView` (of een web
  view-schema met `.passthrough()`) uit `@taakhelden/shared` waar mogelijk,
  i.p.v. alles lokaal te dupliceren. Bestaande lokale types in
  `apps/web/lib/api/types.ts` uitbreiden alleen voor velden die de UI
  render’t.
- **BFF-uitbreiding**:
  - `POST /api/auth/register` — cookie-schrijven (zoals login).
  - Geauthenticeerde CRUD blijft op bestaande `/api/v1/[...path]` (POST/PATCH
    werken al + `Idempotency-Key`).
- **`apiClient`**: `get` + `post` + `patch` volstaan (patch bestaat sinds
  batch 5). Geen DELETE in deze batch.
- **Permissies**:
  - `/gezin` in nav: `requiresFull: true`.
  - **Route-guard**: in de page/layout of client: als session
    `permissions !== "full"`, redirect naar `/vandaag` met nette melding.
    (Batch 4/5 verbergen alleen nav; batch 7 introduceert het guard-patroon
    voor deze ene sectie — herbruikbaar in batch 8 voor Taken/Winkel.)
- **i18n**: nieuwe namespaces in `messages/nl.json` **en** `messages/en.json`:
  - `auth.register.*` (velden, CTA, foutcodes, link naar login)
  - `auth.login.*` uitbreiden met link naar register
  - `nav.gezin`
  - `gezin.*` (code, kinderen, formulieren, AVG-tekst, onboarding-stappen,
    leeg-staten, bevestigingen)
- **Privacy**: log nooit roepnamen, pincodes, invite codes of foto-URLs
  (architectuurregel 5). Client-side `console`/`error` reporting strippen.
- **Design**: ouder-register (kalm, wit, teal accent). Hergebruik `Field`,
  `Input`, `Button`, `Card`, `Alert`, `Badge`. Geen kid-register op deze
  pagina’s. Geen ruwe hex/px — tokens uit `globals.css`.
- **Turnstile**: lazy-load widget; accessibility: fallback-tekst als script
  faalt. Env-documentatie in `apps/web/.env.example` (of README-sectie).

## Tests & kwaliteit

- **API-authz-tests bestaan al** voor register / children / invite-code /
  pincode; deze batch is primair web-only. Geen migraties.
- **Web**:
  - Unit/contract: `RegisterBody` / `CreateChildBody` parse in types-test
    of form-validatie-test (spiegel `lib/api/types.test.ts`).
  - Optioneel: BFF register-route happy path met gemockte `fetch` (als
    bestaand testpatroon dat toelaat).
- Handmatige rooktest:
  1. Uitgelogd → `/register` → account + gezin aanmaken → cookies gezet.
  2. Land op `/gezin` onboarding → kind toevoegen (AVG-check) → kind in lijst.
  3. Gezinscode zichtbaar → kopiëren → hergenereren → nieuwe code.
  4. Pincode resetten voor het kind.
  5. `approve_only`-ouder (indien testbaar) ziet Gezin niet in nav en wordt
     weggeleid bij directe URL.
  6. Login-pagina linkt naar register en omgekeerd.
- `npm run typecheck` groen; `npm run lint` groen; CI groen.

## Definition of done

- [ ] Ouder kan zich registreren via `/register` (Turnstile + BFF cookies).
- [ ] Na registratie landt de ouder in kind-onboarding op `/gezin`.
- [ ] Kindprofiel aanmaken met roepnaam, geboortejaar, PIN + expliciete
      AVG-toestemming (UI); server legt consent vast.
- [ ] Kind bewerken + pincode resetten werken.
- [ ] Gezinscode zichtbaar, kopieerbaar, hergenereerbaar.
- [ ] Nav-item **Gezin** voor `full` parents; route-guard tegen `approve_only`.
- [ ] nl + en strings compleet; positieve/kalme ouder-copy; geen stub-teksten.
- [ ] Geen PII/pincodes/invite codes in logs.
- [ ] `npm run typecheck` + lint groen; CI groen.

## Acceptatiecriteria (PO-vriendelijk)

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | Nieuwe ouder vult registerformulier correct in | Account + gezin aangemaakt, ingelogd, door naar gezin-onboarding |
| 2 | E-mail bestaat al | Duidelijke `EMAIL_IN_USE`-melding, geen sessie |
| 3 | Wachtwoord &lt; 10 tekens | Client-validatie blokkeert submit |
| 4 | Turnstile ontbreekt/faalt (prod) | `VALIDATION_FAILED`, geen account |
| 5 | Eerste kind aanmaken zonder AVG-check | Submit disabled |
| 6 | Kind aanmaken met check | Kind in lijst; Vandaag toont het kind |
| 7 | Gezinscode hergenereren | Oude code ongeldig; UI toont nieuwe |
| 8 | `approve_only` opent `/gezin` | Redirect / geen beheer-UI |
| 9 | Locale EN | Alle nieuwe copy in het Engels |

## Open vragen voor review

1. **Akkoord met scope Registratie + Gezin/kinderen** voor batch 7, met
   co-ouder + gezinsinstellingen naar batch 8?
2. **QR-code in scope of follow-up?** Voorstel: code + kopiëren = must;
   QR = should (zelfde PR als het meevalt, anders ticket in batch 7.1).
3. **Avatar-picker**: vaste placeholder-set (5–8 id’s) of `avatarId`
   weglaten tot de echte bibliotheek klaar is? Voorstel: optioneel veld met
   kleine vaste set; default `null`.
4. **Onboarding als query-param op `/gezin`** vs. aparte `/onboarding/kind`-
   route? Voorstel: query-param (kleinere oppervlakte).
5. **Soft-delete kind** (`DELETE /members/{id}`) meenemen? Voorstel: **nee**
   — hoort bij privacy/AVG-batch samen met account-export/verwijdering.

## Agents / skills bij implementatie

| Onderdeel | Agent / skill |
| --- | --- |
| Pagina’s, forms, nav, BFF register | `@taakhelden-web` |
| Turnstile / authz / consent-UX review | `@taakhelden-security` |
| nl/en catalogs | `@taakhelden-i18n` |
| AVG-consent copy (ouder) | `@taakhelden-product-owner` + kalme oudertoon |
| Design tokens / primitives | `design-system` skill → daarna `/design-check` |
| Route-guard + geen SQL in web | `@architecture-reviewer` vóór merge |
| Tests | `@taakhelden-tester` |

## Samenvatting

Batch 7 maakt van het dashboard een **volledige start**: registreren → kind
toevoegen → gezinscode delen. Dat is de ontbrekende brug tussen de werkende
dagelijkse lus (batch 4–5) en een gezin dat nergens anders vandaan hoeft te
komen. Inzichten, co-ouder en diepere gezinsinstellingen blijven bewust buiten
deze batch.
