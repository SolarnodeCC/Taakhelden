# iOS Phase 2 — remaining workstreams plan

Status after this branch: **core workstreams implemented in code**; device E2E + DPIA paperwork still manual.

## Delivered in code

| Slice | Workstream | Status |
|---|---|---|
| 2a | Gate → `ParentModeRootView` + device-owner LA + idle timeout + deep-link to Goedkeuren | Done |
| 2b | Live `ParentAPIAdapter` + parent JWT path + DI (preview only in tests) | Done |
| 2c | `LiveFamilyRoomClient` (token → WS, 2/4/8 backoff) | Done |
| 2d | Export poll + SIWA re-auth delete | Done |
| 2e | Light Taken / Beloningen management surfaces | Done |
| 2f | Oldest-first queue, photoStatus chips, pinch/swipe photo, bulk failures | Done |
| 2g | Streak forgiveness (1 miss/week) in API + tests | Done |
| 2h | `updated_at` migration + sync delta + silent push hook | Done |
| 2i | Young mode foundations (TTS + picture-PIN practice UI) | Foundations |
| 2j | Widget scaffold + App Group count store | Scaffold |
| 2k | This plan + DPIA checklist still open for legal | Docs |

## Still manual / product

1. Phase 1 2-device E2E checklist (`docs/ios-phase1-e2e-checklist.md`)
2. Apple Developer: App Group, SIWA, push entitlements on the team account
3. Wire `TaakHeldenWidget` target in XcodeGen on macOS (`apps/ios/TaakHeldenWidget/`)
4. Full young-mode design pass (near-textless shell; picture-PIN stored server-side if product wants non-numeric unlock)
5. DPIA finish + public privacy statement + subprocessors + breach runbook drill (`docs/taakhelden-dpia-starter.md`)
6. Staging smoke of parent approve / WS / export against real Worker

## Exit criteria

See bouwvoorstel §11 Fase 2. Production child photos remain blocked until DPIA exit items are checked.
