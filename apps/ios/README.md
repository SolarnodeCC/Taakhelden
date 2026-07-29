# TaakHelden iOS (SwiftUI)

Phase 1 MVP + Phase 2 parent-mode workstreams live in deze map.
Phase 2 core code is **complete** (merged via [#78](https://github.com/SolarnodeCC/Taakhelden/pull/78)).

- iOS 17 minimum
- een familie-app met kind- en oudermodus
- geen permanente ouder-tab in kindmodus
- child mode light-only in MVP
- iPad: multitasking toegestaan (geen `UIRequiresFullScreen` — App Store-eis)

## Bouwvoorstel (leidend)

Zie **[`docs/taakhelden-ios-bouwvoorstel.md`](../../docs/taakhelden-ios-bouwvoorstel.md)**.

- Phase 2 plan: **[`docs/ios-phase2-plan.md`](../../docs/ios-phase2-plan.md)** (code done; residual manual below)
- Phase 3 plan: **[`docs/ios-phase3-plan.md`](../../docs/ios-phase3-plan.md)**

Leidende ADRs:

- `docs/adr/ADR-0001-role-aware-core-endpoints.md`
- `docs/adr/ADR-0002-child-device-refresh-and-under13-unlock.md`
- `docs/adr/ADR-0003-ios-family-app-shell-and-review-constraints.md`
- `docs/adr/ADR-0004-coparenting-data-model.md` (concept — Phase 3 E7)

## Structuur

```
apps/ios/
├── project.yml
├── TaakHelden/TaakHelden.Debug.entitlements    # SIWA + APNs development + App Group
├── TaakHelden/TaakHelden.Release.entitlements  # SIWA + APNs production + App Group
├── Scripts/
│   ├── sync-openapi-contract.sh
│   └── generate-openapi-client.sh   # Swift OpenAPI Generator (macOS CI)
├── openapi/
│   ├── openapi.json
│   └── openapi-generator-config.yaml
├── ReviewNotes.md
├── TaakHelden/
│   ├── App/
│   ├── Core/ (API, Auth, DesignSystem, Parent, ParentGate, Push, Realtime, Sync)
│   ├── Features/ (Child, Onboarding, Parent)
│   └── Resources/ (nl.lproj + en.lproj)
├── TaakHeldenWidget/                # WidgetKit scaffold (XcodeGen wiring still manual)
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

## Phase 2 (geïmplementeerd in code — PR #78)

- Parental gate → live `ParentModeRootView` (device-owner LA of ouder-SIWA)
- Vandaag / Goedkeuren / Taken / Beloningen / Instellingen
- `ParentAPIAdapter` op echte parent-JWT endpoints (preview alleen in tests)
- `LiveFamilyRoomClient` + silent-push refresh hook
- Export-poll + SIWA account-delete
- Streak forgiveness (1 miss/week) in API + tests
- `updated_at` + sync delta
- Young-mode foundations (TTS + picture-PIN oefen-UI)
- Open-task count App Group store + widget scaffold

## Phase 3 — in uitvoering

Plan: **[`docs/ios-phase3-plan.md`](../../docs/ios-phase3-plan.md)**  
Workstreams: **[`docs/ios-phase3-workstreams.md`](../../docs/ios-phase3-workstreams.md)**

Geleverd in code (slices 3a–3f):

- Young-mode chrome (grote targets, TTS, Speak-knop)
- EN/NL kind-strings uitgebreid
- Avatar-catalogus + equip API (`/avatar/catalog`, `/members/:id/avatar`) + Mijn Held shop
- Coöperatieve gezinsdoelen API + kind-kaart + ouder-settings

Nog gepland: E4 onderhandelen, E5 focustimer, E6 Watch, E7 co-ouderschap (ADR), E8 break-glass.

## Nog handmatig (Phase 2 residual — blokkeert geen Phase 3 code-start)

- E2E happy path op **twee fysieke devices** (`docs/ios-phase1-e2e-checklist.md`)
- Apple Developer: signing, SIWA, App Group, push
- Widget-target in XcodeGen op macOS afronden (`TaakHeldenWidget/`)
- Full young-mode design pass (near-textless shell) — opgenomen als Phase 3 carry-in
- DPIA / privacyverklaring exit (`docs/taakhelden-dpia-starter.md`) — blijft productie-foto-blocker
- Staging smoke van parent approve / WS / export tegen Worker
- Staging gezinscode in `ReviewNotes.md` bijwerken

## Lokaal bouwen (macOS)

```bash
npm run openapi:check
cd apps/ios && xcodegen generate
open TaakHelden.xcodeproj
```

- **Debug**: Info.plist/API → `http://localhost:8787/v1` (start API eerst).
- **Release / Archive**: → `https://taakhelden-api.oostelaar.workers.dev/v1`.
- Override: scheme env `TAAKHELDEN_API_BASE_URL` (wint van Info.plist).
- Archive gebruikt `TaakHelden.Release.entitlements` (`aps-environment = production`).

## Design System

Kid UI-kits: `Design System/ui_kits/kid-app/`. Tokens: `apps/web/app/globals.css`.
