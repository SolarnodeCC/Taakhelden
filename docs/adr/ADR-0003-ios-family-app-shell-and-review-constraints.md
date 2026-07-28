# ADR-0003: iOS family-app shell, parental gate, and review constraints

- Status: accepted
- Date: 2026-07-28
- Affects: apps/ios, apps/api, packages/shared
- Hard rules impact: child-privacy, no-negative-mechanics

## Context

The iOS bouwvoorstel requires several product and compliance choices to be fixed
before SwiftUI feature work begins: whether TaakHelden is one app or two,
whether young mode is in MVP, where the Xcode project lives, and how the parent
gate works on a shared iPad. The same proposal also calls out App Store
constraints around metadata, push copy, photo access, and one-device review.

## Decision

TaakHelden ships as one family app with separate child and parent modes.

1. Parent onboarding is part of the iOS MVP.
2. Sign in with Apple is the primary native onboarding path.
3. The minimum supported version is iOS 17.
4. Young mode is not part of the MVP; mid and teen ship first.
5. The Xcode project lives in `apps/ios/`.
6. Parent mode on the child device is protected by a hidden parental gate plus
   LocalAuthentication and/or parent login. There is no permanent "Ouder" tab in
   child mode.
7. Child mode on iPad runs fullscreen to avoid Split View and Stage Manager
   weakening the parental gate.
8. Dark mode is explicitly out of scope for child mode until the branding pass;
   child mode stays light-only for MVP and v1.
9. Photo bonus flows use direct camera capture or an out-of-process picker only;
   the app does not request broad photo-library access.
10. Push alerts stay generic on the lock screen and never include task names,
    child names, or photo details.
11. App Store metadata presents TaakHelden as a family app, not as a
    child-primary app listing.
12. Fase 1 review notes must include a preconfigured family code and child PIN
    so App Review can exercise the child flow on a single device.

## Consequences

This decision narrows early iOS scope and reduces compliance risk. It also means
the MVP must invest in onboarding, gate behavior, and review readiness before
broader parent-dashboard parity.

Future work such as young mode, child dark mode, and richer parent management is
still possible, but it may only build on top of these constraints rather than
undoing them silently.
