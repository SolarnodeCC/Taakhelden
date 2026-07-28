# ADR-0001: Versioned viewer discriminator for role-aware core endpoints

- Status: accepted
- Date: 2026-07-28
- Affects: apps/api, apps/web, apps/ios, packages/shared
- Hard rules impact: familyId-boundary, zod-validation

## Context

Several core endpoints currently return different JSON shapes depending on the
JWT role on the same path, including `/instances/today`, `/points/balance`,
`/rewards`, `/redemptions`, and `/families/me`. That is workable for ad-hoc web
parsers, but it is a poor fit for generated clients and creates a hidden
contract risk for the existing parent dashboard.

The iOS bouwvoorstel requires a formal migration choice before Swift codegen can
start. The same document also requires that web stays green during the
transition and that response schemas move into `packages/shared` first.

## Decision

TaakHelden adopts migration option A from the iOS bouwvoorstel: a versioned
dual-shape migration path.

1. Core role-aware endpoints gain explicit response schemas in
   `packages/shared`.
2. New iOS-facing responses use a `viewer` discriminator with the values
   `"child"` or `"parent"`.
3. The new shapes are served behind `X-Contract-Version: 2` first.
4. Existing web callers continue to receive the legacy parent-first shape when
   no contract version is requested.
5. `apps/web` migrates in the same PR series as the shared schemas and route
   updates. The first web files in scope are the BFF/API types and fetchers that
   parse `instances/today`, `points/balance`, `rewards`, and related approvals
   data.
6. iOS only targets the version-2 contract.

Endpoints that already expose a single stable shape for both roles may keep that
shape until they are touched by iOS needs; the migration pattern still applies.

## Consequences

This adds temporary complexity to the API because two response shapes coexist.
That cost is accepted because it keeps the working dashboard stable while
establishing a generator-friendly contract for iOS.

Exit criteria for this ADR:

- `apps/web` typecheck passes against the migrated shared schemas.
- Existing API and authz tests stay green.
- No iOS codegen lands against a version-2 shape before the web migration is
  merged and validated.

When the web dashboard no longer depends on the legacy shape, the old contract
can be deprecated and later removed in a follow-up ADR or cleanup PR.
