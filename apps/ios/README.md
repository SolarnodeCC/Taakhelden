# TaakHelden iOS (SwiftUI)

Phase 1 heeft nu een **in-repo XcodeGen scaffold** in deze map, volgens het
bouwvoorstel en de goedgekeurde ADRs:

- iOS 17 minimum
- een familie-app met kind- en oudermodus
- geen permanente ouder-tab in kindmodus
- child mode light-only in MVP
- `UIRequiresFullScreen` voor iPad-kindgebruik

## Bouwvoorstel (leidend)

Zie **[`docs/taakhelden-ios-bouwvoorstel.md`](../../docs/taakhelden-ios-bouwvoorstel.md)**.

Leidende ADRs voor dit scaffoldwerk:

- `docs/adr/ADR-0001-role-aware-core-endpoints.md`
- `docs/adr/ADR-0002-child-device-refresh-and-under13-unlock.md`
- `docs/adr/ADR-0003-ios-family-app-shell-and-review-constraints.md`

## Huidige Phase 1-structuur

```
apps/ios/
├── project.yml
├── Scripts/
│   └── sync-openapi-contract.sh
├── openapi/
│   └── openapi-generator-config.yaml
├── ReviewNotes.md
├── TaakHelden/
│   ├── App/
│   ├── Core/
│   │   ├── API/
│   │   ├── Auth/
│   │   ├── DesignSystem/
│   │   └── ParentGate/
│   ├── Features/
│   │   ├── Child/
│   │   └── Onboarding/
│   └── Resources/
└── TaakHeldenTests/
```

## Generated-client pad

Het gedeelde contract blijft de enige bron van waarheid:

1. `packages/shared` genereert `docs/openapi/taakhelden-core-v1.json`
2. `apps/ios/Scripts/sync-openapi-contract.sh` kopieert dat snapshot lokaal naar
   `apps/ios/openapi/openapi.json`
3. `apps/ios/openapi/openapi-generator-config.yaml` reserveert de generatorconfig
4. `Core/API/Generated/` is de vaste map voor toekomstige Swift OpenAPI output

Tot de generatorstap in CI/macOS is geactiveerd: **geen handmatige JSON-DTO’s
toevoegen**. Netwerkimplementaties horen bovenop generatoroutput te landen.

## Huidige foundations

- Keychain-gebaseerde sessieopslag voor ouder- en kindsessies
- child unlock policy met blijvend zichtbare PIN-optie voor onder 13
- dagelijks ontgrendel-scherm met Face ID + zichtbare pincode
- parental gate policy met verborgen ingang + LocalAuthentication
- onboarding foundations voor ouder en kind (incl. SIWA-hook + kind aanmaken)
- kind-shell met tabs voor Mijn Dag, Winkel en Mijn Held (live API + states)
- MutationQueue + SyncEngine voor offline afvinken
- foto-bonus via out-of-process PhotosPicker (geen full library access)
- push-registratie foundation (optioneel, app werkt zonder)
- gegenereerde contractmodellen uit `packages/shared`
- review-notes template voor App Review op een device

## Nog open binnen Phase 1

- Swift OpenAPI Generator client (naast gegenereerde ContractModels)
- SIWA entitlement + productie-identiteit in Xcode
- camera-pad naast PhotosPicker
- beloningsmoment visueel (confetti-component) en geluid achter ouder-instelling
- echte E2E-validatie op 2 fysieke devices tegen staging
- DPIA-documentatie (product, niet alleen code)

## Design System

Kid UI-kits: `Design System/ui_kits/kid-app/` (Mijn Dag, Winkel, Mijn Held).
Tokens: `Design System/tokens/` en `apps/web/app/globals.css`.
