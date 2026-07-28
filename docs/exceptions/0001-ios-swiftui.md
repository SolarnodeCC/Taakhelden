---
code: HB_IOS_SWIFTUI
owner: ios
reason: >
  TaakHelden ships a native SwiftUI child/parent app (apps/ios). Swift is the
  platform-required language for App Store iOS clients; it is not stack drift.
expires: 2027-07-28
migration_plan: >
  Keep product logic behind the shared OpenAPI/Zod contract and HTTP API.
  No plan to rewrite the iOS client in TypeScript; document Swift as an
  intentional platform exception for the mobile surface only.
proof_lane: npm run openapi:check
repair_guidance: >
  Renew only if apps/ios grows product truth outside the API contract
  (local ledger, alternate auth). Do not expand the exception to web/API.
---

# iOS SwiftUI client exception

The Jankurai default stack (Rust + TypeScript + SQL) does not include Swift.
This repo’s child-facing client is intentionally native iOS (SwiftUI) per
`docs/taakhelden-ios-bouwvoorstel.md` and `CLAUDE.md`.

Scope of this exception:

- `apps/ios/**` only
- Contract source of truth remains `packages/shared` + `docs/openapi/`
- No Durable Object / D1 access from iOS — API only
