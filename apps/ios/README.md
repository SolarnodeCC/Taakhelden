# TaakHelden iOS (SwiftUI)

Phase 1 MVP foundations live in deze map, volgens het bouwvoorstel en de
goedgekeurde ADRs:

- iOS 17 minimum
- een familie-app met kind- en oudermodus
- geen permanente ouder-tab in kindmodus
- child mode light-only in MVP
- `UIRequiresFullScreen` voor iPad-kindgebruik

## Bouwvoorstel (leidend)

Zie **[`docs/taakhelden-ios-bouwvoorstel.md`](../../docs/taakhelden-ios-bouwvoorstel.md)**.

Leidende ADRs:

- `docs/adr/ADR-0001-role-aware-core-endpoints.md`
- `docs/adr/ADR-0002-child-device-refresh-and-under13-unlock.md`
- `docs/adr/ADR-0003-ios-family-app-shell-and-review-constraints.md`

## Structuur

```
apps/ios/
├── project.yml
├── TaakHelden.entitlements          # SIWA + APNs development
├── Scripts/
│   ├── sync-openapi-contract.sh
│   └── generate-openapi-client.sh   # Swift OpenAPI Generator (macOS CI)
├── openapi/
│   ├── openapi.json
│   └── openapi-generator-config.yaml
├── ReviewNotes.md
├── TaakHelden/
│   ├── App/
│   ├── Core/
│   │   ├── API/
│   │   ├── Auth/
│   │   ├── DesignSystem/
│   │   ├── ParentGate/
│   │   ├── Push/
│   │   └── Sync/
│   ├── Features/
│   │   ├── Child/
│   │   ├── Onboarding/
│   │   └── Parent/
│   └── Resources/
└── TaakHeldenTests/
```

## Contract & codegen

1. `packages/shared` genereert `docs/openapi/taakhelden-core-v1.json`
2. `apps/ios/Scripts/sync-openapi-contract.sh` kopieert naar `openapi/openapi.json`
3. `packages/shared/scripts/generate-swift-contract.ts` → `ContractModels.swift`
4. `apps/ios/Scripts/generate-openapi-client.sh` → optionele Swift OpenAPI HTTP client
5. `npm run openapi:check` valideert beide snapshots in CI

Handmatige JSON-DTO's toevoegen is niet toegestaan — wijzig het gedeelde contract.

## Phase 1 foundations (geïmplementeerd)

- Keychain-sessies (ouder + kind) met device refresh
- Child unlock: zichtbare PIN voor onder 13 + optionele Face ID
- Parental gate: verborgen gebaar + LocalAuthentication **vóór** settings
- Welcome hub in parent-register (familie-app); kind-koppelen in kid-register
- Paletten gespiegeld aan `apps/web/app/globals.css` (incl. teen-navy + kid-turquoise)
- Ouder-onboarding: Sign in with Apple → kind + gezinscode
- Kind-tabs: Mijn Dag / Winkel / Mijn Held (live API + empty/loading/error)
- MutationQueue + SyncEngine (offline afvinken)
- Foto-bonus: camera + PHPicker, JPEG ~2 MP compressie
- Beloningsmoment: confetti of reduce-motion glow + haptic + chime
- Push: opt-in, optioneel, generieke lockscreen-copy
- WCAG AA palette contrast unit-tests
- App Review-pakket: `ReviewNotes.md` + E2E-checklist + DPIA starter

## Phase 2 — v1 ouder-modus + stevige sync

Zie bouwvoorstel §11 Fase 2. In de codebase o.a.:

- `ParentModeView` / goedkeuringsqueue + bulk
- `FamilyRoomClient` (WebSocket)
- `ParentSyncCoordinator` + delta-sync hooks
- Young-modus, streak-bescherming, export/delete (in uitvoering)

## Phase 3 — later (plan)

Uitgewerkt plan: **[`docs/ios-phase3-plan.md`](../../docs/ios-phase3-plan.md)**

Epics: EN-locale, avatar-shop (verdiende items), coöperatieve gezinsdoelen,
onderhandel-knop (teen), huiswerk-focustimer, Apple Watch, co-ouderschap (ADR-0004),
break-glass support. Android valt buiten iOS-scope.

## Nog handmatig vóór Phase 2 afronding

- E2E happy path op **twee fysieke devices** tegen staging Worker
  (`docs/ios-phase1-e2e-checklist.md`)
- Staging gezinscode in `ReviewNotes.md` bijwerken na review-gezin aanmaken
- Xcode signing team + SIWA capability in Apple Developer portal
- Optioneel: `task-complete.wav` in Resources (systeem-fallback werkt zonder)

## Lokaal bouwen (macOS)

```bash
npm run openapi:check
cd apps/ios && xcodegen generate
open TaakHelden.xcodeproj
```

Stel `TAAKHELDEN_API_BASE_URL` in op het scheme voor staging tests.

## Design System

Kid UI-kits: `Design System/ui_kits/kid-app/`. Tokens: `apps/web/app/globals.css`.
