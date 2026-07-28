---
alwaysApply: false
paths: apps/ios/**/*.swift,apps/ios/**/*.strings
---

# iOS (`apps/ios/`)

SwiftUI child/parent app — consumes the same API contract as web, kid register UI.

## Contract sync

- API changes in `packages/shared` / Worker routes → update OpenAPI and regenerate:
  `apps/ios/Scripts/sync-openapi-contract.sh`.
- Generated client code lives under `TaakHelden/Core/API/Generated/` — do not hand-edit
  generated files; fix the contract or generator config instead.

## Design system

- Visual tokens: `TaakHelden/Core/DesignSystem/DesignSystem.swift` — warm/round kid register.
- Align with `Design System/` and `apps/web/app/globals.css` intent, not ad-hoc colors.

## Privacy (arch rule 5)

- No child e-mail or PII in logs, analytics, or crash reports.
- Photos: same rules as API — no logging URLs; respect EXIF-stripped ready state.

## Localization

- `Resources/nl.lproj/Localizable.strings` and `en.lproj/Localizable.strings`.
- Child-facing strings: positive Dutch tone (`@dutch-child-copy`).

## Auth

- Sign in with Apple per `TaakHelden/Core/Auth/` — verify tokens server-side; no secrets in
  the app bundle beyond what Apple requires.

## Proof lane

- `apps/ios/README.md` documents Xcode setup; run `TaakHeldenTests` when touching foundation
  code (`Phase1FoundationTests.swift`).
