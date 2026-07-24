---
name: developing-ios
description: Build the TaakHelden SwiftUI app in apps/ios against the apps/api contract. Use when working on iOS views, view models, networking, Sign in with Apple, offline/sync, or push notifications. Contract-level guidance — the Xcode project lives outside the repo.
---
# Skill: iOS Development (TaakHelden)
# SCOPE: SwiftUI app in apps/ios; consumes the apps/api contract
# LOAD: when working on iOS views, networking, auth, sync, notifications
# OWNER: iOS Lead

## Role
Senior iOS developer. You build the SwiftUI app children and parents use. You consume the
backend contract (`docs/taakhelden-api-specificatie.md` + `packages/shared` Zod schemas) —
you never reach into `apps/api` internals.

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

> The Xcode project is maintained outside this repository (only `apps/ios/README.md` is
> checked in). Keep work at the contract/behavior level unless the Swift sources are
> actually present.

## Client invariants (from the six hard rules)

- **Idempotency**: generate a stable `Idempotency-Key` (UUID) per user intent; reuse it on
  every retry of the same mutation so a dropped response never double-awards points.
- **Ledger is truth**: display point totals returned by the API. Never sum points on-device
  or keep a local "balance" the UI trusts over the server.
- **No negative mechanics**: never show point loss except an explicit redemption / its undo.
- **Positive Dutch copy**: all child-facing text is Dutch and encouraging (§3.7). Route new
  strings through `@dutch-child-copy`.
- **Privacy**: no child name/PII in logs, analytics, or crash reporting. Upload photos for
  server-side EXIF strip; don't attach identifying metadata.

## Networking pattern (sketch)

```swift
// One place builds requests; mutations always carry an Idempotency-Key.
func complete(taskId: String, key: String) async throws -> LedgerUpdate {
    var req = URLRequest(url: api("/tasks/\(taskId)/complete"))
    req.httpMethod = "POST"
    req.setValue(key, forHTTPHeaderField: "Idempotency-Key")   // stable across retries
    req.setValue("Bearer \(await auth.token())", forHTTPHeaderField: "Authorization")
    let (data, resp) = try await session.data(for: req)
    try validate(resp)                 // map 4xx/5xx to typed errors, never crash on body
    return try decoder.decode(LedgerUpdate.self, from: data)   // shape mirrors packages/shared
}
```

## Auth
- **Sign in with Apple** (mirrors `apps/api/src/services/apple.ts`). Store the session token
  in the **Keychain**; never in `UserDefaults` or plaintext.
- Handle token refresh; a `JWT_SECRET` rotation server-side invalidates sessions — recover
  gracefully to the sign-in screen.

## Realtime & sync
- Subscribe to the family's FamilyRoom WebSocket for live point/task updates.
- Reconnect with backoff (e.g. 2s/4s/8s); fall back to REST reads. Never tight-poll.
- Offline: queue mutations with their Idempotency-Keys and replay on reconnect.

## Accessibility
- Dynamic Type, VoiceOver labels on every control, ≥ 44pt touch targets, AA contrast.
- Child UI: large, friendly, forgiving; celebrate progress (never scold).

## Checklist before submitting
- [ ] Every mutation sends a stable `Idempotency-Key` (reused on retry)
- [ ] Point totals are server-sourced, not computed locally
- [ ] Child-facing strings are Dutch, positive (§3.7)
- [ ] No child PII in logs/analytics/crash reports
- [ ] Tokens in Keychain; graceful re-auth on expiry
- [ ] New/needed contract fields raised to `@taakhelden-backend` (added to `packages/shared` first)

## Docs to Update
| Change | Doc |
|---|---|
| New client-visible endpoint use / behavior | `docs/taakhelden-api-specificatie.md` (with backend) |
| New iOS UX pattern | `docs/taakhelden-productvoorstel.md` |
