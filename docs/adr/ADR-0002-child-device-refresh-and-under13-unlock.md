# ADR-0002: Child device refresh, revoke, and under-13 unlock policy

- Status: accepted
- Date: 2026-07-28
- Affects: apps/api, apps/ios, packages/shared, migrations, D1
- Hard rules impact: familyId-boundary, child-privacy, zod-validation

## Context

The current child login flow issues a 24-hour access token from
`POST /auth/child-session` without a refresh token. That forces children to
re-enter the family code and PIN every day, which is not workable on a shared
family device and blocks the iOS MVP described in the bouwvoorstel.

Apple review guidance also requires that children under 13 always have a
non-biometric alternative next to Face ID or Touch ID. For TaakHelden, PIN may
not be a hidden fallback that appears only after biometric failure.

## Decision

TaakHelden splits the child auth flow into device pairing and daily unlock.

1. `POST /auth/child-session` becomes the one-time pairing step after family
   code + profile + PIN. It issues:
   - a short-lived child access token, and
   - a device-bound child refresh token.
2. A new `POST /auth/child-session/refresh` endpoint rotates a valid child
   refresh token into a new access token and a new refresh token.
3. Child refresh sessions are persisted in D1 with revocation support so a
   parent can unlink a device.
4. Refresh sessions are family-scoped and child-scoped, and never bypass the
   existing authz boundary.
5. iOS uses LocalAuthentication only for biometrics.
6. For children under 13, the unlock screen always shows a visible PIN action
   alongside Face ID or Touch ID. PIN remains a first-class, permanent path, not
   an error fallback.
7. For teens, biometrics may be primary, but PIN remains reachable for
   consistency.

## Consequences

Backend scope increases: a migration, shared schemas, route handling, token
rotation, and revoke flows are required before the iOS app can offer a humane
daily unlock flow.

This decision improves child usability without weakening parental control. It
also creates a clear server-side place to implement "unlink this device" in the
future parent settings flow.

The iOS implementation must not ship a biometric-only child unlock screen for
under-13 users.
