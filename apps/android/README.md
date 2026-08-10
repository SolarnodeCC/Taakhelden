# Wispel Android (Jetpack Compose)

Android-tegenhanger van `apps/ios`. Zelfde API-contract, zelfde invarianten
(idempotentie, positieve NL-copy, geen kind-PII, saldo altijd uit het ledger), zelfde
design tokens.

- minSdk 26 · targetSdk 35 · Kotlin 2.1 · Compose BOM 2024.12
- één familie-app met kind- en oudermodus
- geen permanente ouder-tab in kindmodus (ADR-0003)
- kindmodus light-only; teenmodus donker (navy/mint) — bewuste keuze, niet systeemvolgend

## Modulestructuur

```
apps/android/
├── settings.gradle.kts          # :app wordt alleen ingesloten mét Android SDK
├── gradle/libs.versions.toml
├── core/                        # Kotlin/JVM — bouwt en test zónder Android SDK
│   └── src/main/kotlin/nl/taakhelden/core/
│       ├── api/                 # transport, API-client, GEGENEREERDE ContractModels.kt
│       ├── auth/                # AuthStore, PinHasher, SecureStore-interface
│       ├── child/               # dag-, winkel-, avatar-, doel- en voorstelstores
│       ├── parent/              # ParentModeStore, mapper, approval-regels
│       ├── sync/                # MutationQueue, SyncEngine, PhotoBonusService
│       ├── realtime/            # FamilyRoom WebSocket-client
│       ├── gate/                # ouderpoort-beleid en coördinator
│       └── designsystem/        # tokens, paletten, HeroProgress, YoungMode
└── app/                         # Android + Compose
    └── src/main/kotlin/nl/taakhelden/family/
        ├── platform/            # EncryptedSharedPreferences, biometrie, TTS, foto's
        ├── auth/                # Sign in with Apple (web-flow)
        ├── push/                # FCM-registratie en -ontvangst
        ├── ui/                  # theme, components, onboarding, child, parent, …
        └── widget/              # Glance-widget "nog N taken"
```

**Waarom twee modules?** Alle app-logica die geen Android-framework nodig heeft zit in
`:core`. Dat maakt de port testbaar op elke JDK — de 59 unit tests draaien in CI zonder
emulator of SDK. `:app` bevat alleen Compose-UI en platformdiensten.

`settings.gradle.kts` sluit `:app` alleen in wanneer er een SDK gevonden wordt
(`ANDROID_HOME` of `sdk.dir` in `local.properties`). Zonder SDK blijft `:core:test`
gewoon draaien in plaats van dat de hele build faalt.

## Bouwen

```bash
# alleen de logica (geen Android SDK nodig)
gradle -p apps/android :core:test

# volledige app (vereist Android SDK)
export ANDROID_HOME=/pad/naar/android-sdk
gradle -p apps/android :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

Debug-build tegen een lokale Worker: zet in `apps/android/local.properties`

```properties
TAAKHELDEN_API_BASE_URL=http://10.0.2.2:8787/v1
```

`10.0.2.2` is de host-loopback vanuit de emulator. Zonder override gebruikt elke build de
productie-Worker — er is bewust géén localhost-fallback (dat brak ooit een iOS-Reviewbuild).

## Contract-synchronisatie

`ContractModels.kt` is **gegenereerd** — niet handmatig bewerken:

```
packages/shared (Zod)
  └─ scripts/generate-swift-contract.ts   → apps/ios/.../ContractModels.swift
  └─ scripts/generate-kotlin-contract.ts  → apps/android/.../ContractModels.kt
```

`npm run openapi:check` faalt zodra één van beide afwijkt. Nieuwe request/response-velden
gaan dus altijd eerst naar `packages/shared`.

## Verschillen met iOS (en waarom)

| Onderwerp | iOS | Android | Reden |
|---|---|---|---|
| Sessieopslag | Keychain | EncryptedSharedPreferences (Keystore) | platform-equivalent; zelfde salt+SHA-256 PIN-blob |
| Ouderpoort | LocalAuthentication | BiometricPrompt (biometrie **of** schermvergrendeling) | een ouder zonder vingerafdruk moet er nog steeds door |
| Kind-unlock | Face ID + zichtbare pincode | biometrie + zichtbare pincode | ADR-0002 ongewijzigd |
| Push | APNs | FCM | Worker kiest de gateway op `platform` (zie `notifier.ts`) |
| Sign in with Apple | native `ASAuthorizationController` | Apple web-flow in een Custom Tab | Android heeft geen native SIWA; de Worker verifieert hetzelfde `identityToken` |
| Reduce Motion | `accessibilityReduceMotion` | verlengde a11y-timeout als signaal | Android kent geen directe vlag |
| Widget | WidgetKit | Glance | platform-equivalent |
| Standaardtaal | nl + en | **nl is default**, en in `values-en/` | doelgroep is NL; een onbekende locale hoort Nederlands te krijgen |

## Nog handmatig (blokkeert de code niet)

- **Apple Services ID + redirect** invullen in `AppEnvironment.APPLE_SERVICES_ID` /
  `APPLE_REDIRECT_URI`. Zolang die leeg zijn meldt de knop netjes dat ouder-login nog niet
  beschikbaar is in plaats van een kapotte webpagina te openen.
- **`google-services.json`** in `app/` plaatsen voor push. Zonder dat bestand wordt de
  Firebase-plugin niet toegepast en is push een stille no-op — de app werkt volledig door.
- **FCM-servercredentials** (`FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`) als
  Worker-secrets zetten; zonder die drie verstuurt `fcmSend` niets (net als APNs vandaag).
- **Play-signing** en een release-keystore.
- **E2E happy path op twee fysieke toestellen**, zoals bij iOS.
- **DPIA / privacyverklaring** blijft de productie-fotoblocker (gedeeld met iOS).

## Design system

Tokens komen uit `nl.taakhelden.core.designsystem` en spiegelen
`apps/web/app/globals.css`. Gebruik `WispelTheme.palette` en de primitives in
`ui/components/` — nooit een ruwe hex of een losse dp-waarde in een scherm.
