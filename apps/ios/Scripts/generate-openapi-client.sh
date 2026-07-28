#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
IOS_DIR="$ROOT_DIR/apps/ios"
SPEC="$IOS_DIR/openapi/openapi.json"
CONFIG="$IOS_DIR/openapi/openapi-generator-config.yaml"
OUT_DIR="$IOS_DIR/TaakHelden/Core/API/Generated/OpenAPI"

if [[ ! -f "$SPEC" ]]; then
  echo "Missing OpenAPI spec at $SPEC — run sync-openapi-contract.sh first." >&2
  exit 1
fi

if ! command -v swift-openapi-generator >/dev/null 2>&1; then
  echo "swift-openapi-generator not installed; skipping generated HTTP client."
  echo "ContractModels.swift remains the typed contract layer until macOS CI installs the tool."
  exit 0
fi

mkdir -p "$OUT_DIR"
swift-openapi-generator generate \
  --config "$CONFIG" \
  --output-directory "$OUT_DIR" \
  "$SPEC"

echo "Generated Swift OpenAPI client in $OUT_DIR"
