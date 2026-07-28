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
  - de privacyverklaring de foto-retentie noemt,
  - de subprocessors-lijst publiek beschikbaar is,
  - en de DPIA is afgerond.
