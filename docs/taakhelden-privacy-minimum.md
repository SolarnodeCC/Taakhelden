# TaakHelden privacy minimum — Fase 0

Dit document legt het minimale beleidskader vast dat volgens het iOS-bouwvoorstel
moet bestaan voordat foto-gerelateerde flows naar echte gezinnen in productie
gaan. Het vervangt geen volledige DPIA; het is de ondergrens voor Fase 0.

## 1. Foto-retentie

- Taakfoto's in R2 en de gekoppelde D1-metadata blijven **maximaal 30 dagen**
  bewaard na upload/ready-status.
- Mislukte uploads of strip-failures worden zo snel mogelijk verwijderd.
- Deze retentie mag niet stilzwijgend worden verlengd "voor support".
- Oudergerichte copy moet dit expliciet noemen: foto's worden na 30 dagen
  verwijderd.

## 2. Subprocessors (huidige MVP-stack)

| Provider | Doel | Regio / opmerking |
|---|---|---|
| Cloudflare Workers / D1 / R2 / KV / Durable Objects / Queues | API, database, foto-opslag, async verwerking | EU-first: D1 `weur`, R2 `eu` |
| Apple (Sign in with Apple, APNs) | Ouder-auth en pushverkeer | Apple-platformdienst |
| E-mailprovider (indien geconfigureerd) | Co-ouderuitnodigingen | Alleen voor ouder-e-mail, nooit kind-PII |

Uitgangspunt: geen third-party analytics of advertentie-SDK's in het kindpad.

## 3. Toegang tot gezinsdata

- Producttoegang loopt uitsluitend via family-scoped JWT-auth en repo-functies
  met `familyId` als security-grens.
- Er is **geen** standaard support- of adminfunctie die gezinsdata of kinderfoto's
  kan lezen.
- Als later break-glass support nodig is, moet dat apart ontworpen worden met:
  audit-log, time-limited access, named accounts en vier-ogencontrole.

## 4. Datalek-runbook (concept)

Bij een vermoed datalek:

1. **Detectie en triage**  
   Bevestig welke bron geraakt is (D1, R2, KV, tokens, push).
2. **Containment**  
   Trek relevante refresh/device sessions in, blokkeer verdere toegang en
   verwijder blootgestelde signed URLs of objecten waar mogelijk.
3. **Impactanalyse**  
   Bepaal of kinderdata, foto's of ouderaccounts betrokken zijn.
4. **Meldplicht**  
   Beoordeel binnen 72 uur of melding aan de Autoriteit Persoonsgegevens nodig is.
5. **Communicatie naar ouders**  
   Informeer betrokken ouders in begrijpelijk Nederlands over impact,
   vervolgstappen en contactpunt.
6. **Herstel en postmortem**  
   Leg oorzaak, impact, remediatie en structurele preventie vast.

## 5. Relatie met DPIA

- Een volledige DPIA blijft verplicht vóór launch, conform het productvoorstel.
- Tot die DPIA afgerond is, mogen staging- en reviewflows alleen synthetische of
  ouder-eigen testfoto's gebruiken.
- Productiegebruik met echte kinderfoto's blijft geblokkeerd totdat:
  - dit privacy minimum bestaat,
  - de privacyverklaring de foto-retentie noemt (**publiek:** `/privacy` in `apps/web`),
  - de subprocessors-lijst publiek beschikbaar is (zie `/privacy`),
  - en de DPIA is afgerond.

## 6. AI-verwerking

Beleid: [`ADR-0006`](./adr/ADR-0006-ai-policy-and-approved-use-cases.md) ·
scope: [`wispel-ai-workstreams.md`](./wispel-ai-workstreams.md).

- Er draait **vandaag geen AI** over gezinsdata. Zolang dat zo is, staat dat ook zo op `/privacy`.
- Als AI wordt geactiveerd, geldt: **alleen Cloudflare Workers AI**, uitsluitend op **aggregaten
  en pseudoniemen** (`kind_1`), nooit op namen, geboortejaren, foto's of kind-geschreven vrije
  tekst met identificerende inhoud.
- Cloudflare documenteert voor Workers AI dat klantcontent niet wordt gebruikt om modellen te
  trainen en niet met andere klanten wordt gedeeld, maar biedt **geen EU-only inferentieregio**
  (anders dan D1 `weur` en R2 `eu`). De-identificatie is daarom geen extra maatregel maar de
  dragende maatregel.
- Wij bewaren uitsluitend de **gegenereerde tekst**, nooit de prompt. Prompts worden niet gelogd.
- Toestemming is een **aparte, intrekbare ouder-toggle** (default uit) achter de parental gate.
  Intrekken verwijdert de opgeslagen gegenereerde teksten.
- De subprocessorlijst (§2) krijgt een rij *Cloudflare Workers AI — gede-identificeerde
  weekaggregaten* op het moment dat de eerste AI-feature live gaat, niet eerder.
- Toolchain (agents, code-review, copy-concepten) valt buiten deze verwerking, maar nooit buiten
  de regel: **geen productiedata in een prompt**.
