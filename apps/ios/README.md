# TaakHelden iOS (SwiftUI)

Phase 1 MVP + Phase 2 parent-mode workstreams live in deze map.

- iOS 17 minimum
- een familie-app met kind- en oudermodus
- geen permanente ouder-tab in kindmodus
- child mode light-only in MVP
- `UIRequiresFullScreen` voor iPad-kindgebruik

## Bouwvoorstel (leidend)

Zie **[`docs/taakhelden-ios-bouwvoorstel.md`](../../docs/taakhelden-ios-bouwvoorstel.md)**.
Phase 2 plan: **[`docs/ios-phase2-plan.md`](../../docs/ios-phase2-plan.md)**.

Leidende ADRs:

- `docs/adr/ADR-0001-role-aware-core-endpoints.md`
- `docs/adr/ADR-0002-child-device-refresh-and-under13-unlock.md`
- `docs/adr/ADR-0003-ios-family-app-shell-and-review-constraints.md`

## Structuur

```
apps/ios/
├── project.yml
├── TaakHelden.entitlements          # SIWA + APNs + App Group
├── Scripts/
├── openapi/
├── ReviewNotes.md
├── TaakHelden/
│   ├── App/
│   ├── Core/ (API, Auth, DesignSystem, Parent, ParentGate, Push, Realtime, Sync)
│   ├── Features/ (Child, Onboarding, Parent)
│   └── Resources/
├── TaakHeldenWidget/                # optional WidgetKit scaffold
└── TaakHeldenTests/
```

## Phase 2 (geïmplementeerd in code)

- Parental gate → live `ParentModeRootView` (device-owner LA of ouder-SIWA)
- Vandaag / Goedkeuren / Taken / Beloningen / Instellingen
- `ParentAPIAdapter` op echte parent-JWT endpoints (preview alleen in tests)
- `LiveFamilyRoomClient` + silent-push refresh hook
- Export-poll + SIWA account-delete
- Young-mode foundations (TTS + picture-PIN oefen-UI)
- Open-task count App Group store + widget scaffold

## Nog handmatig

- E2E happy path op **twee fysieke devices** (`docs/ios-phase1-e2e-checklist.md`)
- Apple Developer: signing, SIWA, App Group, push
- Widget-target in XcodeGen op macOS afronden
- DPIA / privacyverklaring exit (`docs/taakhelden-dpia-starter.md`)
- Staging smoke tegen Worker

## Lokaal bouwen (macOS)

```bash
npm run openapi:check
cd apps/ios && xcodegen generate
open TaakHelden.xcodeproj
```

Stel `TAAKHELDEN_API_BASE_URL` in op het scheme voor staging tests.
