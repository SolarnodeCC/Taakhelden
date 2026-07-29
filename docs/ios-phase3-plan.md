# iOS Phase 3 — plan & uitwerking

*Uitwerking van **Fase 3 — Later** uit `docs/taakhelden-ios-bouwvoorstel.md` §11. Leidend voor iOS; product-roadmap in `docs/taakhelden-productvoorstel.md` §8 kan afwijken — zie §1.2.*

**Status:** plan ter beslissing — geen implementatie in deze fase-documentatie.  
**Basis:** Phase 2 core code is **complete** (merged [#78](https://github.com/SolarnodeCC/Taakhelden/pull/78), 2026-07-29). Zie `docs/ios-phase2-plan.md`.

---

## 1. Scope & positionering

### 1.1 Doel

Phase 3 breidt TaakHelden iOS uit van een **volwassen familie-app** (Phase 1 kind-MVP + Phase 2 ouder-modus/sync) naar een **rijkere, marktbrede ervaring** zonder de zes harde architectuurregels te breken. Focus: engagement op secundaire surfaces (Watch, avatar-progressie), coöperatieve gezinsmechanieken, tiener-autonomie, internationale uitbreiding, young-mode design completion, en — als aparte, zware epic — co-ouderschap over twee huishoudens.

### 1.2 Afstemming product-roadmap

| Onderwerp | iOS bouwvoorstel | Productvoorstel §8 | Besluit voor dit plan |
|---|---|---|---|
| Widget | Phase 2 (optioneel) | Phase 2 | **Scaffold in #78**; XcodeGen wiring + polish = residual / Phase 3 E6-input |
| Young-modus (full design) | Phase 2 | — | **Foundations in #78**; full near-textless pass = Phase 3 carry-in **E0** |
| Coöperatieve gezinsdoelen | Phase 3 | Phase 2 | Phase 3 (iOS leidend) |
| Co-ouderschap | Phase 3 | Phase 2 | Phase 3 — **geen half werk** (§9) |
| Apple Watch | Phase 3 | Phase 2 (widget) / Phase 3 (Watch) | Phase 3 — bouwt op `OpenTaskCountStore` |
| Avatar-shop | Phase 3 | Phase 3 | Phase 3 |
| Huiswerk-focustimer | niet expliciet | Phase 3 | Phase 3 epic (iOS-relevant) |
| EN-locale | Phase 3 | Phase 3 | Phase 3 — **uitbreiden** (ouder-strings al deels in `en.lproj` via #78) |
| Android | Phase 3 (vermelding) | Phase 3 | **Buiten scope** — apart platform, geen iOS-werk |

### 1.3 Harde voorwaarden (onveranderd)

1. Geen handmatige JSON-DTO's — alles via `packages/shared` → OpenAPI → Swift codegen.
2. Mutaties idempotent (`Idempotency-Key` stabiel per intent).
3. Punten = ledger-som; avatar-items en gezinsdoelen wijzigen het saldo alleen via bestaande ledger-paden.
4. Geen negatieve mechanieken (geen ranglijst broer/zus; gezinsdoel is coöperatief, niet competitief).
5. Geen kind-PII in logs, Watch-complications of push-teksten.
6. Kindgerichte copy NL-first; EN via bestaande `*.lproj` / `Localizable.xcstrings` + `@dutch-child-copy` review voor NL.

### 1.4 Phase 2-status (na PR #78)

Phase 2 **code-exit is gehaald**. Phase 3 feature-werk mag starten. Residual items hieronder blokkeren **geen** Phase 3 code-PRs, behalve waar expliciet genoteerd.

| Bouwvoorstel §11 Fase 2 | Status na #78 |
|---|---|
| Ouder-modus: Vandaag, goedkeuringsqueue, licht taken/beloningen, instellingen | ✅ Done (`ParentModeRootView`, slices 2a–2f) |
| `FamilyRoomClient` + reconnect/backoff | ✅ Done (`LiveFamilyRoomClient`, 2/4/8 s) |
| Delta-sync + `updated_at` + stille push → background sync | ✅ Done (migratie `0007`, silent-push hook) |
| Streak-bescherming in lijn met productcopy | ✅ Done (1 miss/week + `points-streak` tests) |
| In-app accountverwijdering + data-export | ✅ Done (export-poll + SIWA re-auth delete) |
| Widget “nog N taken” | 🟡 Scaffold + App Group store; XcodeGen target wiring nog handmatig |
| `ageMode: young` (beeld-PIN, voorleesknop, grote targets) | 🟡 Foundations (TTS + picture-PIN practice UI); full design → Phase 3 **E0** |
| Privacyverklaring + datalek-runbook + DPIA | 🔴 Nog open — blijft **productie-foto-blocker** |
| 2-device E2E + staging smoke | 🔴 Handmatig (zie `docs/ios-phase1-e2e-checklist.md`) |

**Bron:** `docs/ios-phase2-plan.md` + merge [#78](https://github.com/SolarnodeCC/Taakhelden/pull/78).

---

## 2. Epic-overzicht & aanbevolen volgorde

| # | Epic | Complexiteit | Backend | Design | Aanbevolen volgorde |
|---|---|---|---|---|---|
| **E0** | Young-mode design pass (carry-in uit #78) | M | Laag* | H | 0 — product/design; optioneel server picture-PIN |
| **E1** | EN-locale (i18n) — uitbreiden | M | Laag | Laag | 1 — ouder-strings al deels aanwezig |
| **E2** | Avatar-shop (verdiende items) | M | M | M | 2 — bouwt voort op Mijn Held + `lifetimeEarned` |
| **E3** | Coöperatieve gezinsdoelen | M | M | M | 3 — zelfstandig; geen co-ouderschap nodig |
| **E4** | Onderhandel-knop (teen) | M | M | Laag | 4 — vereist notificatie + ouder-queue |
| **E5** | Huiswerk-focustimer | M | Laag | M | 5 — grotendeels lokaal; optioneel server-koppeling |
| **E6** | Apple Watch companion (+ widget polish) | H | M | M | 6 — hergebruikt `OpenTaskCountStore` / App Group |
| **E7** | Co-ouderschap (2 huishoudens) | **Zeer hoog** | **Zeer hoog** | M | 7 — alleen na ADR + migratie; geen voorbereidende shortcuts |
| **E8** | Break-glass support-toegang | H | H | — | 8 — beleid + audit; geen product-feature voor kind |

\*Picture-PIN server-side alleen als product non-numeric unlock wil (ADR).

**Niet in Phase 3 iOS:** Android-app (apart repo/team), mascotte “Vinkie”, IAP/echte aankopen in kind-UI, Kids Category.

**Herbruikbaar uit Phase 2 (#78):** `ParentAPIAdapter`, `LiveFamilyRoomClient`, `ParentModeStore`, sync delta, streak engine, `OpenTaskCountStore`, `YoungModeSupport`, `en.lproj`/`nl.lproj` parent strings, widget scaffold.

---

## 2a. Epic E0 — Young-mode design pass (Phase 2 carry-in)

### Doel

Phase 2 leverde **foundations** (`YoungModeSupport`, TTS, picture-PIN practice UI). Phase 3 maakt young (4–7) product-klaar: near-textless shell, grote targets, voorlees overal, optioneel server-opgeslagen beeld-PIN.

### Scope

| In scope | Buiten / later |
|---|---|
| Near-textless Mijn Dag / Winkel / Held | Volledige mascotte “Vinkie” |
| Voorleesknop op taken, beloningen, empty states | Competitie-UI |
| Picture-PIN als **dagelijkse unlock** (als ADR) | Numeriek PIN verwijderen voor mid |
| Extra grote tap-targets (≥64 pt) | Aparte young App Store listing |

### Exit-criteria

- [ ] Young-profiel doorloopt dagelijkse unlock + afvinken zonder leesvaardigheid
- [ ] `@dutch-child-copy` + VoiceOver-pass
- [ ] Geen regressie mid/teen

---

## 3. Epic E1 — EN-locale (internationalisatie)

### 3.1 Doel

Ouders en tieners in niet-NL markten kunnen de app in het Engels gebruiken. Kind-modus blijft pedagogisch NL-first tot een bewuste EN-kindcopy-pass (aparte `@dutch-child-copy`-equivalent review).

**Update na #78:** parent-modus heeft al `en.lproj`/`nl.lproj` Localizable.strings voor gate/parent surfaces. E1 is **geen greenfield** — afronden van dekking + kind-chrome + App Store strings + locale-preference.

### 3.2 Scope

| Surface | MVP Phase 3 | Later |
|---|---|---|
| Ouder-modus (instellingen, goedkeuren, vandaag) | EN | — |
| Onboarding ouder (SIWA, kind aanmaken) | EN | — |
| Kind-modus UI-chrome (tabs, knoppen) | EN | — |
| Kind-modus vierende copy (confetti, empty states) | NL + EN | Young-modus EN voorlees apart |
| Push lockscreen-teksten | Generiek NL/EN per device-locale | — |
| App Store metadata | EN listing (marketing) | Buiten engineering |

### 3.3 Technisch

```
TaakHelden/Resources/
├── nl.lproj/Localizable.strings   # al aanwezig (#78 parent surfaces)
├── en.lproj/Localizable.strings   # al aanwezig (#78); uitbreiden
└── (optioneel) Localizable.xcstrings  # migratiepad als team String Catalogs prefereert
```

- Geen hardcoded NL in SwiftUI-views; `String(localized:)` / `LocalizedStringKey`.
- `AppLanguage` preference in ouder-instellingen: *Volg systeem* | *Nederlands* | *English* — kind-modus erft van device of ouder-keuze achter gate.
- CI: snapshot of lint die nieuwe strings zonder vertaling flagt.
- API-foutcodes blijven machine-keys; user-facing mapping in client per locale.
- Gap-analyse t.o.v. #78: kind-tabs empty/loading/error, celebrations, onboarding kind-koppelen, ReviewNotes EN.

### 3.4 Exit-criteria

- [ ] Ouder-flow volledig bruikbaar in EN op device met `en` locale
- [ ] Geen regressie NL-default
- [ ] App Store privacy labels en permission strings EN
- [ ] Review notes EN-versie bij submit

---

## 4. Epic E2 — Avatar-shop (verdiende items)

### 4.1 Product

Uit productvoorstel §3.4: *“met levels ontgrendel je gratis avatar-accessoires (petjes, achtergronden). Geen echte aankopen in de kinderomgeving.”*

Dit is **geen** App Store IAP-shop — het is een **progressie-laag in Mijn Held**: items unlocken op basis van `lifetimeEarned` / level / badges.

### 4.2 UX (Mijn Held-uitbreiding)

| Element | Gedrag |
|---|---|
| **Shop-tab binnen Held** | Sub-segment: *Mijn avatar* | *Ontgrendeld* | *Nog te verdienen* |
| **Itemkaart** | Preview op avatar; unlock-conditie (“Level 5” / “Badge Eerste week”) |
| **Equip** | `PATCH /members/{id}` met `equippedItems[]` — idempotent |
| **Locked item** | Positief: “Nog 2 levels te gaan — jij kunt dit!” — geen slot/ketting |
| **Young-modus** | Alleen iconen + voorlees van itemnaam |

### 4.3 Contract (nieuw in `packages/shared`)

```typescript
// Voorbeeld — exacte shapes in shared + migratie
AvatarCatalogItem {
  id: string
  slot: "hat" | "background" | "accessory"
  unlock: { type: "level" | "badge" | "lifetimePoints"; threshold: number }
  previewAssetId: string
  sortOrder: number
}
MemberAvatarState {
  equipped: Record<slot, catalogItemId | null>
  unlocked: catalogItemId[]
}
```

**API (concept):**

| Endpoint | Rol | Beschrijving |
|---|---|---|
| `GET /avatar-catalog` | child, parent | Statische catalogus (versioned) |
| `GET /members/{id}/avatar` | child (eigen), parent | Equipped + unlocked |
| `PATCH /members/{id}/avatar` | child (eigen) | Equip/unequip; Idempotency-Key |

Ledger raakt **niet** — unlock is afgeleid van bestaande `lifetimeEarned` + badges; server is bron van waarheid bij equip-conflict.

### 4.4 iOS-structuur

```
Features/MijnHeld/
├── MijnHeldView.swift
├── AvatarShopView.swift
├── AvatarPreviewCompositor.swift   # emoji/SF + equipped layers
└── AvatarShopViewModel.swift
```

- Catalogus gebundeld als fallback; server-version in `GET /avatar-catalog` voor nieuwe items zonder app-update (feature-flag).
- Contrast-tests op equipped previews (WCAG AA).

### 4.5 Exit-criteria

- [ ] Kind equipt pet + achtergrond; zichtbaar in header Mijn Dag
- [ ] Unlock op level-up zonder app-restart (sync of WS)
- [ ] Geen IAP-sku's; App Review notes vermelden “cosmetic progression only”
- [ ] Contract-tests + fixture-update in CI

---

## 5. Epic E3 — Coöperatieve gezinsdoelen

### 5.1 Product

Optioneel gezinsdoel: *“samen 500 punten = pizza-avond”* (productvoorstel §3.4). **Geen** individuele ranglijst; voortgang is **som van alle kinderen** (of ouder-gedefinieerde subset).

### 5.2 UX

**Ouder (achter gate):**

1. Instellingen → *Gezinsdoel* → aan/uit, titel, icoon, streefbedrag (punten), optionele deadline.
2. Voortgangsbalk in ouder Vandaag-header (alle kinderen samen).

**Kind:**

- Compacte kaart op Mijn Dag (onder streak): “Jullie zijn al op 320 van de 500 punten — samen sterker!”
- Bij halen: gezinsbrede celebratie (confetti + chime); **geen** “jij hebt het meeste bijgedragen”.

### 5.3 Regels (architectuur)

| Regel | Implementatie |
|---|---|
| Voortgang | `SUM(positive ledger entries)` voor geselecteerde `childIds` sinds `goal.startedAt` — **niet** huidig saldo |
| Geen puntenaftrek | Redemptions tellen niet mee als negatief; doel meet “verdiend in periode” |
| Eén actief doel | MVP: max 1 actief per gezin |
| Offline | Kind ziet laatste server-snapshot; geen lokale voortgang-authority |

### 5.4 Contract

```typescript
FamilyGoal {
  id: string
  title: string
  icon: string
  targetPoints: number
  childIds: string[]          // leeg = alle kinderen
  startedAt: string
  completedAt?: string
  status: "active" | "completed" | "archived"
}
FamilyGoalProgress {
  goalId: string
  earnedPoints: number        // server-berekend
  targetPoints: number
}
```

| Endpoint | Rol |
|---|---|
| `GET /families/me/goals` | parent + child (read) |
| `POST /families/me/goals` | parent |
| `PATCH /families/me/goals/{id}` | parent (archiveren) |
| `GET /families/me/goals/active/progress` | parent + child |

Ledger-write bij voltooiing: optionele `family_goal_bonus` entry (positief, audit-trail) — **aparte ADR** of geen bonus (puur metaforisch doel).

### 5.5 Exit-criteria

- [ ] Ouder stelt doel in; beide kinderen zienzelfde voortgang
- [ ] Geen sibling-ranking UI in codebase (lint/review-check)
- [ ] WS-event `family_goal_progress` voor live update ouder-modus
- [ ] `@dutch-child-copy` review op vierende copy

---

## 6. Epic E4 — Onderhandel-knop (teen)

### 6.1 Product

Tiener kan een **voorstel** doen: extra taak of hogere punten (“mag ik 20 punten voor auto wassen?”). Stimuleert eigenaarschap zonder automatische punten — ouder beslist.

### 6.2 UX

| Stap | Actor | UI |
|---|---|---|
| 1 | Teen | Op taakkaart of FAB: *Voorstel doen* |
| 2 | Teen | Formulier: taak (nieuw of bestaand), voorgestelde punten, korte motivatie (max 140 tekens) |
| 3 | Server | `NegotiationRequest` status `pending` |
| 4 | Ouder | Queue in ouder-modus (badge); **Accepteren** (maakt taak/aanpassing) / **Later bekijken** / **Vriendelijk afwijzen** |
| 5 | Teen | Push (generiek) + in-app: positieve uitkomstcopy |

**Alleen `ageMode: teen`** — geen knop in mid/young (ouders kunnen jongere kinderen niet overbelasten met onderhandel-UX).

### 6.3 Contract

```typescript
NegotiationRequest {
  id: string
  childId: string
  taskId?: string
  proposedTitle?: string
  proposedPoints: number
  message?: string
  status: "pending" | "accepted" | "declined" | "expired"
  createdAt: string
  resolvedAt?: string
  resolutionNote?: string   // positief, zichtbaar voor kind
}
```

| Endpoint | Rol |
|---|---|
| `POST /negotiations` | teen child |
| `GET /negotiations` | parent (filter pending), child (eigen) |
| `POST /negotiations/{id}/accept` | parent — idempotent; maakt taak of patch instance points |
| `POST /negotiations/{id}/decline` | parent — verplicht `resolutionNote` (positief) |

### 6.4 Copy-richtlijnen

| ❌ Niet | ✅ Wel |
|---|---|
| “Afgewezen” | “We kiezen nu voor een andere afspraak — misschien volgende week?” |
| “Te veel punten” | “Laten we samen kijken naar een passende beloning” |

### 6.5 Exit-criteria

- [ ] End-to-end: teen voorstel → ouder accepteert → taak verschijnt in Mijn Dag
- [ ] Decline vereist positieve `resolutionNote`
- [ ] Geen onderhandel-knop zichtbaar voor mid/young
- [ ] Push generiek op lockscreen

---

## 7. Epic E5 — Huiswerk-focustimer

### 7.1 Product

Toetsdatum-taken en focus-modus (productvoorstel §7): *“elke dag 15 min Frans tot de toets”* — timer als hulpmiddel, geen straf bij stoppen.

### 7.2 Scope Phase 3

| In scope | Buiten scope |
|---|---|
| Pomodoro-achtige timer (15/25 min presets + custom) | Volledige weekplanner/huiswerk-CRM |
| Gekoppeld aan taak-instance (optioneel) | Puntenaftrek bij vroeg stoppen |
| Lokale timer + Live Activity (iOS 17+) | Screen Time API / MDM |
| Bij complete: bestaande taak-afvink-flow | Aparte “studie-minuten” ledger |

### 7.3 UX

- Start vanuit taakkaart: *Focus starten* (alleen `category: homework` of ouder-flag).
- Volledig scherm minimal UI: resterende tijd, pauze, stop — **positief** bij stop: “Goed bezig! Zin om later verder te gaan?”
- `Reduce Motion`: geen pulserende animatie; statische ring.
- Young: pictogrammen + voorlees “Nog vijf minuten focus”.

### 7.4 Technisch

- `FocusTimerSession` in SwiftData (lokaal); geen server-sync vereist voor MVP.
- Optioneel: `POST /instances/{id}/focus-sessions` voor ouder-inzichten (Phase 4 / web Inzichten).
- Live Activity: generieke titel “TaakHelden focus” — **geen** taaknaam op lockscreen (privacy).

### 7.5 Exit-criteria

- [ ] Timer completeert; kind kan daarna normaal afvinken
- [ ] Geen negatieve copy bij annuleren
- [ ] Live Activity werkt op iOS 17+; graceful fallback zonder
- [ ] VoiceOver op resterende tijd

---

## 8. Epic E6 — Apple Watch companion (+ widget polish)

### 8.1 Doel

Lage drempel: *“vandaag nog 2 taken”* zonder iPhone te openen. Geen volledige app-pariteit.

**Update na #78:** `OpenTaskCountStore` (App Group) + `TaakHeldenWidget/OpenTasksWidget.swift` scaffold bestaan al. E6 (1) rondt widget XcodeGen/signing af en (2) voegt watchOS companion toe die dezelfde snapshot-bron deelt.

### 8.2 watchOS-scope

| Complication | Data |
|---|---|
| **Circular / rectangular** | Open taken count vandaag (zelfde App Group / phone push als widget) |
| **Modular** | Punten (server snapshot) — optioneel, uitzetbaar in Watch-instellingen |

| App (Watch) | Functie |
|---|---|
| **Today list** | Read-only lijst open taken (titels OK op Watch — device is persoonlijk; geen lockscreen) |
| **Complete** | Één tap → queue via `WatchConnectivity` → iPhone `MutationQueue` → `/sync` |
| **Geen** | Winkel, foto, onderhandelen, ouder-modus |

### 8.3 Architectuur

```
TaakHeldenWatch/          # watchOS target
├── TaakHeldenWatchApp.swift
├── TodayView.swift
└── WatchSyncReceiver.swift

TaakHelden/Core/Watch/
├── PhoneWatchSession.swift    # WCSession delegate on iOS
└── WatchSnapshotBuilder.swift # compact TodaySnapshot (feeds widget + Watch)
```

- **Phone is orchestrator**: Watch stuurt intent + idempotency key; iPhone voert API uit (JWT in Keychain op phone).
- Snapshot push bij: sync success, WS event (`LiveFamilyRoomClient`), `scenePhase` active.
- Offline Watch: toon laatste snapshot + “Open je iPhone om te syncen”.
- Widget: XcodeGen target + entitlements op team-account afronden (Phase 2 residual).

### 8.4 Backend

Geen aparte Watch-endpoints. Hergebruik `GET /instances/today` (child viewer) via phone relay.

### 8.5 Exit-criteria

- [ ] Widget toont actuele open-count op homescreen (XcodeGen target live)
- [ ] Complication toont actuele open-count na phone sync
- [ ] Complete op Watch → punten via phone → server (idempotent)
- [ ] Geen JWT op Watch Keychain
- [ ] TestFlight met Watch paired; review notes vermelden Watch-flow

---

## 9. Epic E7 — Co-ouderschap (twee huishoudens)

### 9.1 Waarschuwing

> *“Grote datamodel-breuk — niet half voorbereiden”* (bouwvoorstel §11, risico §13).

Geen `family_id` foreign keys “even uitbreiden” zonder volledig ontwerp. **Geen Phase 3-code** tot ADR-0004 (concept) is goedgekeurd.

### 9.2 Productvraag

Kind leeft in twee huishoudens (NL co-ouderschap). Ouders willen:

- Gedeeld of gescheiden puntenbeleid
- Taken/beloningen per huis of gespiegeld
- Geen dubbele controle over hetzelfde kindprofiel

### 9.3 Ontwerpopties (ADR-0004)

| Optie | Beschrijving | Pro | Con |
|---|---|---|---|
| **A. Child-link** | Eén `child_identity`; twee `family_memberships` | Eén ledger per kind | Complexe autorisatie |
| **B. Gespiegelde profielen** | Twee child records gekoppeld via `linked_child_id` | Eenvoudiger per gezin | Sync-conflicten, dubbele avatar |
| **C. Primair + gast** | Primair gezin + read-only secundair | Minder backend | Tweede huis frustratie |

**Aanbeveling voor PO-workshop:** optie A met één ledger en `household_id` op instances — maar alleen na juridisch/AVG-review (DPIA § co-ouderschap).

### 9.4 iOS-impact (na ADR)

- Profielkiezer toont “bij mama” / “bij papa” als twee memberships
- Onboarding: uitnodiging tweede ouder via bestaande invite-flow uitgebreid
- Geen Phase 3 UI-mockups in code tot ADR vastligt

### 9.5 Exit-criteria (epic)

- [ ] ADR-0004 goedgekeurd
- [ ] D1-migratie + authz-tests
- [ ] iOS + web + API gelijktijdige release
- [ ] DPIA-update met co-ouderschap-verwerking

---

## 10. Epic E8 — Break-glass support-toegang

### 10.1 Context

Productvoorstel §10.2: standaard **geen** god-mode. Als support toch nodig is: time-limited, audit-log, 4-ogen.

### 10.2 Scope (beleid + backend; minimale iOS)

| Component | Eigenaar |
|---|---|
| Audit-tabel `support_access_grants` | API |
| Admin CLI / internal dashboard | DevOps — **niet** in kind-app |
| iOS | Geen support-UI; optioneel toon generieke banner “Ondersteuning bekijkt je verzoek” als grant actief |

### 10.3 iOS-touchpoints

- Geen support-ingang in kind- of ouder-UI
- Privacyverklaring link (ouder-instellingen) beschrijft break-glass
- Push blijft generiek

### 10.4 Exit-criteria

- [ ] Runbook + audit-query gedocumenteerd
- [ ] Geen support-route in App Store build
- [ ] Security-review (`@taakhelden-security`)

---

## 11. Benodigde ADR's vóór implementatie

| ADR | Onderwerp | Blokkeert |
|---|---|---|
| **ADR-0004** | Co-ouderschap datamodel (§9) | E7 volledig |
| **ADR-0005** | Avatar-catalogus versioning & unlock-regels | E2 |
| **ADR-0006** | Gezinsdoel-voortgangsberekening | E3 |
| **ADR-0007** | Negotiation → taak/punten mapping | E4 |
| **ADR-0008** | WatchConnectivity security model | E6 |
| **ADR-0009** | i18n: ouder vs kind locale policy | E1 |

Bestaande ADR's (0001–0003) blijven van kracht.

---

## 12. Mappenstructuur (uitbreiding `apps/ios`)

```
apps/ios/TaakHelden/
├── Features/
│   ├── MijnHeld/
│   │   └── AvatarShop/           # E2
│   ├── FamilyGoal/             # E3 — kind-kaart
│   ├── Negotiation/            # E4 — teen only
│   ├── FocusTimer/             # E5
│   └── Parent/
│       └── FamilyGoalSettings/ # E3
├── Core/
│   ├── Watch/                  # E6
│   └── Localization/           # E1
└── Resources/
    └── Localizable.xcstrings   # NL + EN

apps/ios/TaakHeldenWatch/       # E6 — watchOS target
```

---

## 13. Teststrategie (Phase 3)

| Laag | Dekking |
|---|---|
| **Contract** | Nieuwe schemas: `AvatarCatalog`, `FamilyGoal`, `NegotiationRequest` fixtures |
| **Unit** | `FamilyGoalProgressCalculator`, `NegotiationStateMachine`, `WatchSnapshotBuilder` |
| **Integration** | Watch → Phone → MutationQueue → mock API |
| **UI (spaarzaam)** | Snapshot: AvatarShop grid, family goal card, teen negotiate form |
| **Manual** | Watch + twee kinderen gezinsdoel; EN locale ouder-flow |
| **Security** | Co-ouderschap authz (na E7); geen PII in Watch complications logs |

Bestaande §9.2 MutationQueue-tests blijven verplicht groen.

---

## 14. Phase 3 totaal exit-criteria

Phase 3 is **klaar** wanneer:

1. **E0–E6** zijn afgerond en in TestFlight.
2. **E7** is afgerond *of* expliciet uitgesteld met PO-besluit (ADR-0004 niet goedgekeurd).
3. **E8** runbook + audit bestaat (geen user-facing feature).
4. Alle nieuwe endpoints hebben authz-tests in `apps/api/test`.
5. `npm run openapi:check` + iOS contract-tests groen.
6. Web-dashboard toont gezinsdoel + negotiation queue (pariteit waar product dat vereist).
7. App Review notes bijgewerkt (Watch, geen IAP, co-ouderschap demo indien E7 live).
8. Phase 2 residual: 2-device E2E + staging smoke afgevinkt; DPIA af vóór productie-foto's (onafhankelijk van feature-exit).

---

## 15. Risico's

| Risico | Mitigatie |
|---|---|
| Co-ouderschap halverwege modelleren | ADR-0004 gate; geen `linked_family` shortcuts |
| Avatar-shop lijkt op IAP | Copy + Review notes; geen StoreKit |
| Watch JWT-lek | Phone-only auth; WatchConnectivity encrypted payload |
| Gezinsdoel → sibling rivalry | Geen per-kind breakdown in kind-UI; code review checklist |
| EN kind-copy te formeel/onvriendelijk | Aparte copy-pass; niet alleen machine-translate |
| Focustimer → strafgevoel | Geen ledger-koppeling bij abandon; positieve stop-copy |
| Young-mode half af (foundations only) | E0 expliciet in scope; niet “impliciet klaar” door #78 |
| DPIA open → productie-foto's | Blijft hard gate; Phase 3 features mogen zonder echte kinderfoto's |
| Scope creep (Android, Vinkie) | Expliciet buiten Phase 3 |

---

## 16. Referenties

- `docs/taakhelden-ios-bouwvoorstel.md` §11 Fase 3
- `docs/ios-phase2-plan.md` + PR [#78](https://github.com/SolarnodeCC/Taakhelden/pull/78)
- `docs/taakhelden-productvoorstel.md` §3.4, §7, §8
- `docs/taakhelden-api-specificatie.md`
- `docs/ios-phase1-e2e-checklist.md`
- `docs/adr/ADR-0004-coparenting-data-model.md` (concept)
- `apps/ios/README.md`
- `Design System/ui_kits/kid-app/MijnHeldScreen.jsx`

---

## 17. Beslislijst kickoff Phase 3

1. Bevestig epic-volgorde §2 inclusief **E0** young-mode carry-in (PO).
2. Keur ADR-0005 t/m 0009 goed vóór eerste nieuwe-feature epic (0004 alleen voor E7).
3. Wijs backend-eigenaar voor `FamilyGoal` + `Negotiation` schemas.
4. Design: avatar-item previews + gezinsdoel-kaart + young near-textless shell.
5. Akkoord: co-ouderschap (E7) mag slippen; E0–E6 niet afhankelijk van E7.
6. Marketing: EN App Store listing parallel aan E1.
7. Parallel track: DPIA + 2-device E2E (Phase 2 residual) — eigenaar security/PO, niet iOS-feature-blocker.
