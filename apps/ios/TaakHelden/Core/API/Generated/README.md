This directory is reserved for Swift OpenAPI Generator output.

Source of truth:
- `packages/shared`
- generated snapshot: `docs/openapi/taakhelden-core-v1.json`
- local synced copy: `apps/ios/openapi/openapi.json`

Generation contract:
1. Run `npm run openapi:generate` from the repo root.
2. Run `apps/ios/Scripts/sync-openapi-contract.sh`.
3. Generate the Swift client on macOS using the config in `apps/ios/openapi/openapi-generator-config.yaml`.

Do not add hand-written transport DTOs here.
