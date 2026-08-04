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
