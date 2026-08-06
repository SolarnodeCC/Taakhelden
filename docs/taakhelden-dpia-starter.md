# TaakHelden DPIA — starter (Fase 1)

Status: **gestart** — dit document is het startpunt voor de verplichte DPIA vóór
productie met echte kinderfoto's. Het vervangt nog geen volledige DPIA.

Zie ook: `docs/taakhelden-privacy-minimum.md` (Fase 0 ondergrens).

## 1. Doel en scope

TaakHelden verwerkt gegevens van kinderen (roepnaam, geboortejaar, taken, punten,
optionele taakfoto's) in een gezinscontext. De DPIA dekt:

- iOS kind-app + ouder-onboarding
- API (Worker, D1, R2, FamilyRoom DO)
- Ouder-dashboard (web)

Co-ouderschap over twee huishoudens (fase 3) was buiten scope van deze starter; zie §5a voor de aanvulling (ADR-0004 Proposed).

## 2. Gegevenscategorieën

| Categorie | Voorbeelden | Kind-PII? |
|---|---|---|
| Identiteit kind | Roepnaam, avatar-id, geboortejaar, ageMode | Beperkt (geen e-mail) |
| Gedrag / gamification | Taken, punten, streaks, beloningen | Nee (geen free-text PII) |
| Foto's | Taakfoto's (EXIF gestript) | Ja (beeld) |
| Apparaat | APNs-token, device refresh | Pseudoniem |
| Ouder | E-mail (SIWA), displayName | Ouder-PII |

## 3. Rechtsgrond en toestemming

- Grondslag kindgegevens: ouderlijke toestemming (AVG art. 8) bij aanmaken kindprofiel.
- iOS vastlegt PIN + biometrie-opt-in; backend bewaart geen kind-PIN plat.

## 4. Risico's (eerste inventarisatie)

| Risico | Ernst | Mitigatie (bestaand/gepland) |
|---|---|---|
| Onbevoegde toegang gezinsdata | Hoog | familyId-repo-grens, JWT, geen admin god-mode |
| Kindfoto's zichtbaar buiten gezin | Hoog | R2 signed URLs, EXIF-strip, 30d retentie |
| Lockscreen lekt taak/kinddetails | Midden | Generieke push-copy (ADR-0003) |
| Biometrie zonder PIN onder 13 | Midden | Zichtbare pincode-route (ADR-0002) |
| Analytics/tracking kindpad | Midden | Geen third-party SDK's in kindpad |

## 5a. Co-ouderschap — aanvullende verwerkingsactiviteit (fase 3)

> **Status:** in scope zodra ADR-0004 (co-ouderschap datamodel) is aanvaard.
> Dit gedeelte is een *starter* — geen volledige DPIA-sectie. Een DPO/FG-review is
> vereist vóór activatie van de tweede-huishouden-feature in productie.

### Nieuwe verwerkingsactiviteit

Bij co-ouderschap ontstaat een **gedeeld kindprofiel** (`child_identities`) dat zichtbaar
is vanuit twee afzonderlijke gezinnen. De volgende verwerking is additioneel ten opzichte
van §1–§4:

| Element | Toelichting |
|---|---|
| **Gedeelde gegevens** | Roepnaam, geboortejaar, `age_mode`, avatar-id. Geen e-mail of contactinfo van het kind. |
| **Geïsoleerde gegevens** | Ledger (punten), taken, beloningen en inwisselingen zijn strikt per `family_id` — huis A ziet nooit de ledger van huis B. |
| **Verwerkingsverantwoordelijkheid** | Beide gezinnen zijn potentieel (mede-)verwerkingsverantwoordelijke voor de gedeelde identiteitsgegevens. Juridisch advies vereist over of een verwerkersovereenkomst tussen de twee ouders nodig is. |
| **Rechtsgrond** | Ouderlijk gezag (AVG art. 8); het aanmakende gezin heeft toestemming geregistreerd (`consent_by`, `consent_at`). De tweede ouder moet expliciet instemmen via uitnodigingsflow vóór het lidmaatschap actief wordt. |
| **Datastromen** | Wispel-backend koppelt de twee gezinnen uitsluitend via de `family_memberships`-tabel; er is geen directe communicatiekanaal tussen gezin A en B. |

### Risicoanalyse (aanvulling)

| Risico | Ernst | Mitigatie |
|---|---|---|
| Ledger-data van huis A zichtbaar in huis B via bug | Hoog | Per-family `family_id`-scope op alle repo-queries; authz-testmatrix (`ADR-0004-authz-matrix.md`) |
| Roepnaam-wijziging in huis A zichtbaar in huis B | Laag (bewust ontwerp) | Gebruikers worden geïnformeerd via onboarding-UI; staat beschreven in privacyverklaring |
| Tweede ouder met ongewenste toegang tot kindprofiel | Hoog | Uitnodiging vereist actie van het eerste gezin (consent_parent); geen "self-join" mogelijk |
| Account-verwijdering raakt gedeelde identiteit | Hoog | Soft-delete op `child_identities` alleen als ALLE lidmaatschappen removed/deleted zijn; verwijdering huis A schort enkel `family_memberships` voor huis A op — huis B onaangetast |
| Toegangsverzoek kind omvat beide huishoudens | Midden | Export (`/account/export`) genereert per gezin; ouder A ontvangt alleen export van gezin A. Totale identiteitsexport is aparte AVG art. 15-procedure. |
| Profilering kind over twee huishoudens heen | Hoog | Geen analytics-join over huishoudens; backend voert geen cross-family aggregatie uit |

### Open acties vóór activatie co-ouderschap in productie

- [ ] Juridisch advies verwerkersovereenkomst / gezamenlijke verwerkingsverantwoordelijkheid
- [ ] Privacyverklaring uitbreiden: wat wordt gedeeld bij co-ouderschap, hoe verwijderen
- [ ] Consent-flow tweede ouder: expliciete opt-in + bewijs-opslag
- [ ] Account-verwijdering testen: huis A verwijdert → huis B onaangetast (E2E-test)
- [ ] AVG art. 15-procedure voor cross-family identiteitsexport documenteren
- [ ] DPO/FG-review op deze sectie

---

## 5b. AI-verwerking — aanvullende verwerkingsactiviteit (Gate G-AI)

Beleid: [`ADR-0006`](./adr/ADR-0006-ai-policy-and-approved-use-cases.md).
Deze sectie moet **afgerond en juridisch getoetst** zijn vóór de eerste modelaanroep over
gezinsafgeleide data (Gate G-AI in [`wispel-ai-workstreams.md`](./wispel-ai-workstreams.md)).

### Nieuwe verwerkingsactiviteit

Het genereren van een wekelijkse, ouder-facing samenvattingstekst uit reeds bestaande
weekaggregaten, via Cloudflare Workers AI. Geen nieuwe gegevensverzameling — een nieuw
**doel** en een nieuwe **ontvanger** voor bestaande gegevens.

| Element | Toelichting |
| --- | --- |
| **Verwerkte gegevens** | Weekaggregaten per kind: verdiende/uitgegeven punten, afgerond/totaal, streak, categorieën van slippende taken, en een verschil t.o.v. vorige week. Kinderen worden aangeduid als `kind_1..n`. |
| **Uitgesloten gegevens** | Roepnaam, `childId`, `familyId`, geboortejaar, `age_mode`-koppeling aan een naam, avatar-id, foto's, taaktitels (ouder-geschreven vrije tekst), en elke door een kind geschreven tekst. |
| **Ontvanger** | Cloudflare (Workers AI) als subverwerker. Geen andere modelaanbieder. |
| **Verwerkingsverantwoordelijke** | Ongewijzigd — Wispel. |
| **Rechtsgrond** | Toestemming van de ouder (AVG art. 6 lid 1 sub a), apart van de algemene accountgrondslag, intrekbaar, **default uit**. Voor kindgegevens blijft AVG art. 8 (ouderlijk gezag) het kader. |
| **Bewaartermijn** | Alleen de gegenereerde tekst, in D1, zolang de betreffende week zichtbaar is in Inzichten. Prompts worden niet opgeslagen en niet gelogd. Intrekken van toestemming verwijdert de opgeslagen teksten. |
| **Geautomatiseerde besluitvorming** | **Geen.** De output is beschrijvende tekst voor een ouder; er volgt geen besluit, geen puntenmutatie en geen rechtsgevolg (AVG art. 22 niet van toepassing). |
| **Profilering van kinderen** | Uitgesloten als doel. Geen stemmings-, emotie- of gedragsvoorspelling (R3 in ADR-0006). Geen vergelijking tussen kinderen. |

### Risicoanalyse (aanvulling)

| Risico | Ernst | Mitigatie |
| --- | --- | --- |
| Kind-PII lekt via de prompt | Hoog | De-identificatie in de promptbouwer; test die een gezin met echte namen voedt en asserteert dat geen naam in de payload voorkomt; codereview-regel (`CLAUDE.md` regel 8) |
| Geen EU-only inferentieregio bij Workers AI | Midden | Alleen aggregaten en pseudoniemen; geen bijzondere categorieën; Cloudflare-toezegging dat klantcontent niet voor training wordt gebruikt en niet met andere klanten wordt gedeeld |
| Ongewenste of onjuiste tekst over een kind | Midden | Zod-validatie, deterministische fallback, `@dutch-child-copy`-toonreview, "klopt dit niet?"-actie voor de ouder, kill switch |
| Toestemming onduidelijk of impliciet | Hoog | Aparte toggle achter de parental gate, default uit, in gewone taal, met `/privacy`-sectie — tevens de Apple 5.1.2(i)-verplichting |
| Functiekruip richting kind-facing AI | Hoog | AI-2 en R1/R5 in ADR-0006; herziening vereist een nieuwe ADR |
| Promptinjectie via kind- of oudertekst | Midden | Vrije tekst gaat niet in deze prompt; waar wel (WS-AI-GUARD) staat hij nooit in de system-prompt en kan hij geen ander gezin bereiken |
| Productiedata in toolchain-prompts | Midden | Alleen synthetische fixtures; regel vastgelegd in `.claude/rules/ops/ci-and-agent.md` |

### Open acties vóór activatie AI in productie

- [ ] DPO/FG-review op deze sectie
- [ ] Privacyverklaring uitbreiden: sectie "AI bij Wispel" (NL + EN) + subprocessorrij
- [ ] Toestemmingsflow: aparte ouder-toggle, default uit, intrekken wist gegenereerde teksten
- [ ] De-identificatietest in `apps/api/test/` (namen komen niet in de payload)
- [ ] Kill switch (KV) aantoonbaar werkend zonder deploy
- [ ] Nederlandse eval-set met before/after vastgelegd
- [ ] App Store privacy-labels en age-rating-vragenlijst opnieuw beoordeeld

---

## 5. Open acties vóór productie-foto's

- [ ] Volledige DPIA uitwerken met FG/DPO-review
- [ ] Privacyverklaring publiceren met foto-retentie (30 dagen)
- [ ] Subprocessors-lijst op website
- [ ] Datalek-runbook oefenen (zie privacy-minimum §4)
- [ ] Staging/review alleen synthetische of ouder-eigen testfoto's

Zie ook `docs/ios-phase2-plan.md` (workstream 2k).

## 6. Fase 1 exit

Fase 1 vereist dat deze DPIA **gestart** is (dit document). Afronding blijft een
Fase 2-exit-criterium vóór echte kinderfoto's in productie.
