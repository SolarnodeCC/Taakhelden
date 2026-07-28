# TaakHelden iOS (SwiftUI)

Het Xcode-project leeft in deze map (zie bouwvoorstel voor scaffold via XcodeGen).
Minimumrichtlijn: **iOS 17**, SwiftUI, één familie-app met kind- en oudermodus.

## Bouwvoorstel (leidend)

Zie **[`docs/taakhelden-ios-bouwvoorstel.md`](../../docs/taakhelden-ios-bouwvoorstel.md)** voor:

- aansluiting op `apps/api` + `apps/web` + Design System
- kritieke contract-gaps (OpenAPI, kind-sessie, APNs)
- auth-/offline-/push-model
- SwiftUI × design-tokens mapping
- faseplan (fase 0 contract → MVP kind → v1 ouder)

Het gegenereerde fase-0-contractsnapshot staat in
`docs/openapi/taakhelden-core-v1.json` en wordt in CI op drift gecontroleerd.

Tot die beslissingen vastliggen: geen handmatige JSON-DTO’s “tijdelijk” — dat wordt permanente drift.

## Geplande structuur

```
TaakHelden/
├── App/            entrypoint, dependency container
├── Features/       MijnDag/ Winkel/ MijnHeld/ Onboarding/ Parent/
├── Core/
│   ├── API/        Swift OpenAPI Generator-client (uit packages/shared)
│   ├── Sync/       offline queue (stabiele Idempotency-Keys) + /sync
│   ├── Storage/    SwiftData-modellen (lokale mirror)
│   ├── Push/       APNs, deep links
│   └── DesignSystem/  paletten (kid/teen/parent), SF Rounded, spacing/radius
└── Resources/      NL copy, avatar-catalogus
```

## Afspraken (invarianten)

- Alle API-calls via de gegenereerde client; nooit handmatige JSON.
- Afvinken werkt offline: mutatie in lokale queue → `/sync` bij verbinding; Idempotency-Key stabiel per intent.
- Puntensaldo altijd server-sourced (ledger); nooit lokaal “vertrouwd” saldo.
- Gebruikersgerichte teksten in het Nederlands, positief geformuleerd (stijlgids §3.7).
- Tokens in Keychain; geen kind-PII in logs/analytics/crash reports.
- Foto-upload: JPEG ~2 MP client-side (EXIF-strip gebeurt server-side).

## Design System

Kid UI-kits: `Design System/ui_kits/kid-app/` (Mijn Dag · Winkel · Mijn Held; TeenMode = register, geen aparte tab).
Tokens: `Design System/tokens/` — op iOS gemapt naar `Core/DesignSystem` (SF Rounded i.p.v. Fredoka-websubstituut).
