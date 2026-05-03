#!/usr/bin/env bash
set -euo pipefail

# Required env vars
: "${BAO_API_KEY:?BAO_API_KEY is required}"
: "${BAO_API_URL:?BAO_API_URL is required}"
: "${VERSION:?VERSION is required}"
: "${ASSETS_DIR:?ASSETS_DIR is required}"

ASSETS=(manifest.json worker.js rotation-worker.js migrations.zip tf.zip)
VERIFY_ASSETS=(worker.js rotation-worker.js migrations.zip tf.zip)

mkdir -p "$ASSETS_DIR"

# 1. Resolve presigned URLs and download each asset
for asset in "${ASSETS[@]}"; do
  echo "Downloading $asset..."

  presigned=$(curl -fsSL \
    -H "Authorization: Bearer $BAO_API_KEY" \
    "$BAO_API_URL/v1/releases/$VERSION/$asset" \
    | jq -r '.url')

  curl -fsSL "$presigned" -o "$ASSETS_DIR/$asset"
done

# 2. Verify SHA-256 hashes against manifest
echo "Verifying asset integrity..."
for asset in "${VERIFY_ASSETS[@]}"; do
  expected=$(jq -r ".assets[\"$asset\"].sha256" "$ASSETS_DIR/manifest.json")
  actual=$(sha256sum "$ASSETS_DIR/$asset" | cut -d' ' -f1)
  if [ "$expected" != "$actual" ]; then
    echo "::error::Hash mismatch for $asset: expected $expected, got $actual" >&2
    exit 1
  fi
  echo "  $asset ✓"
done

# 3. Extract archives
unzip -oq "$ASSETS_DIR/migrations.zip" -d "$ASSETS_DIR/migrations"
unzip -oq "$ASSETS_DIR/tf.zip"         -d "$ASSETS_DIR/tf"
echo "Assets extracted."
