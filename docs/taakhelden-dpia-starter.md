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

Niet in scope van deze starter: co-ouderschap over twee huishoudens (fase 3).

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
