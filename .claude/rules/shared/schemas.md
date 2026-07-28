---
alwaysApply: false
paths: packages/shared/**/*.ts
---

# Shared contracts (`packages/shared/`)

Zod schemas and error codes are the **single contract** between API, web BFF, and iOS
(Jankurai: contract and boundary integrity).

## Change order (arch rule 6)

1. Add or change schema in `packages/shared/src/schemas/<resource>.ts`.
2. Export from `packages/shared/src/index.ts`.
3. New error codes in `packages/shared/src/errors.ts` (`ErrorCodes`).
4. Update API routes/repo and web types consumers.

Never add request/response fields only in routes or web without updating shared first.

## Schema design

- Use Zod for all API bodies, query params, and response shapes exposed to clients.
- Prefer strict objects; avoid `z.any()` on public API surfaces.
- Dutch user-facing error messages can live in API layer; codes and shapes live here.

## Types vs runtime

- Shared package is consumed by API (runtime validation) and web (types).
- Breaking changes require coordinated API + web updates and API spec doc updates.

## Verification

```bash
npm run typecheck --workspaces --if-present
npm test   # API tests exercise schemas indirectly
```

## Documentation

- Public API behavior: `docs/taakhelden-api-specificatie.md` must stay aligned with schemas.
- OpenAPI for iOS: generated/synced from contract — see `apps/ios/Scripts/sync-openapi-contract.sh`.
