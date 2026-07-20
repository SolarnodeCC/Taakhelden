# TaakHelden iOS (SwiftUI)

Het Xcode-project wordt hier aangemaakt (Xcode → New Project → iOS App,
naam "TaakHelden", interface SwiftUI, min. iOS 16).

Geplande structuur:
```
TaakHelden/
├── App/            entrypoint, dependency container
├── Features/       MijnDag/ Winkel/ MijnHeld/ Onboarding/  (per feature: View + ViewModel)
├── Core/
│   ├── API/        gegenereerde modellen uit OpenAPI (packages/shared) + client
│   ├── Sync/       offline queue (Idempotency-Keys), /sync-endpoint
│   └── Storage/    SwiftData-modellen (lokale mirror)
└── DesignSystem/   kleuren, SF Rounded-typografie, leeftijdsmodi (young/mid/teen)
```

Afspraken:
- Alle API-calls via de gegenereerde client; nooit handmatige JSON.
- Afvinken werkt offline: mutatie in lokale queue → /sync bij verbinding.
- Gebruikersgerichte teksten in het Nederlands, positief geformuleerd (stijlgids §3.7).
