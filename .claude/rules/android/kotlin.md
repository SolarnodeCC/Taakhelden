---
alwaysApply: false
paths: apps/android/**/*.kt,apps/android/**/*.kts,apps/android/**/*.xml
---

# Android (`apps/android/`)

Compose kind/ouder-app op hetzelfde API-contract als iOS en web.

## Modulegrens

- **`:core`** is Kotlin/JVM en mag **nooit** een Android-import krijgen (`android.*`,
  `androidx.*`). Dat is wat de logica testbaar houdt zonder emulator.
- **`:app`** bevat Compose-UI en platformdiensten. Nieuwe pure logica hoort in `:core`,
  met een test ernaast.

## Contract sync

- `core/src/main/kotlin/nl/taakhelden/core/api/ContractModels.kt` is **gegenereerd** door
  `packages/shared/scripts/generate-kotlin-contract.ts` — niet handmatig bewerken.
- Contractwijziging → eerst `packages/shared`, dan beide generators, dan de consumers.
- `npm run openapi:check` bewaakt Swift én Kotlin.

## Design system

- Kleuren en maten uitsluitend via `nl.taakhelden.core.designsystem` en
  `WispelTheme.palette` / `WDimens`. Nooit een ruwe hex of losse `.dp` in een scherm.
- Kies het register bewust op schermniveau (`WRegister.PARENT` / `KID` / `TEEN`);
  componenten kiezen nooit zelf een palet.
- Herbruik de primitives in `ui/components/` in plaats van ad-hoc markup.

## Strings (arch rule: NL-copy)

- Alle user-facing tekst in `res/values/strings.xml` (nl, default) én
  `res/values-en/strings.xml`. `MissingTranslation` is een lint-**error**.
- `:core` bevat geen copy: het geeft een `UserMessage` terug die `ui/UserMessages.kt`
  naar een resource vertaalt.
- Kindteksten positief formuleren (`@dutch-child-copy`, productvoorstel §3.7).

## Privacy (arch rule 5)

- Nooit kindnamen, foto-URL's, presigned links of pushtokens loggen.
- Backup en device-transfer blijven uitgezet (`data_extraction_rules.xml`).
- Sessies en de PIN-hash alleen in `EncryptedSecureStore`; gewone voorkeuren in
  `AppPreferences`.

## Idempotentie (arch rule 2)

- Ledger-rakende mutaties gebruiken `IdempotencyKey` of een sleutel die bewaard blijft tot
  de call slaagt. Een retry mag nooit een nieuwe sleutel maken.

## Proof lane

```bash
gradle -p apps/android :core:test
gradle -p apps/android :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

`:core:test` draait zonder Android SDK; `:app` wordt alleen ingesloten wanneer er een SDK
gevonden wordt.
