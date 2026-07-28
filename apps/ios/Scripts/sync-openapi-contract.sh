#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
SOURCE_SPEC="$ROOT_DIR/docs/openapi/taakhelden-core-v1.json"
TARGET_DIR="$ROOT_DIR/apps/ios/openapi"
TARGET_SPEC="$TARGET_DIR/openapi.json"

if [[ ! -f "$SOURCE_SPEC" ]]; then
  echo "OpenAPI snapshot ontbreekt: $SOURCE_SPEC" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
cp "$SOURCE_SPEC" "$TARGET_SPEC"

echo "Synced OpenAPI snapshot to $TARGET_SPEC"
echo "Next step on macOS/Xcode: run Swift OpenAPI Generator against apps/ios/openapi/openapi.json"
