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
- parental gate policy met verborgen ingang
- onboarding foundations voor ouder en kind
- kind-shell met tabs voor Mijn Dag, Winkel en Mijn Held
- design tokens vertaald naar SwiftUI paletten/components
- review-notes template voor App Review op een device

## Nog open binnen Phase 1

- echte Swift OpenAPI-generator output
- SIWA entitlement/configuratie
- offline MutationQueue + `/sync`
- foto bonus-flow
- pushregistratie/deep links
- ouder approvals-queue uit fase 2

## Design System

Kid UI-kits: `Design System/ui_kits/kid-app/` (Mijn Dag, Winkel, Mijn Held).
Tokens: `Design System/tokens/` en `apps/web/app/globals.css`.
