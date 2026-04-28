#!/usr/bin/env bats

SCRIPT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)/download-assets.sh"

# ── helpers ───────────────────────────────────────────────────────────────────

# Writes fake asset files to FIXTURE_DIR and a matching manifest.json with
# real SHA-256 hashes so verification passes by default.
setup_fixtures() {
  echo "worker-content"          > "$FIXTURE_DIR/worker.js"
  echo "rotation-worker-content" > "$FIXTURE_DIR/rotation-worker.js"
  printf "PK\x03\x04migrations" > "$FIXTURE_DIR/migrations.zip"
  printf "PK\x03\x04tf"         > "$FIXTURE_DIR/tf.zip"

  local json='{"assets":{'
  for asset in worker.js rotation-worker.js migrations.zip tf.zip; do
    local hash
    hash=$(sha256sum "$FIXTURE_DIR/$asset" | cut -d' ' -f1)
    json+="\"$asset\":{\"sha256\":\"$hash\"},"
  done
  json="${json%,}}}"
  echo "$json" > "$FIXTURE_DIR/manifest.json"
}

# Writes a curl stub to MOCK_BIN.
# - API calls (have -H "Authorization:...") return a presigned:// URL JSON response.
# - Download calls copy the matching file from FIXTURE_DIR to the -o destination.
# FIXTURE_DIR must be exported before calling this.
write_curl_mock() {
  cat > "$MOCK_BIN/curl" << 'EOF'
#!/usr/bin/env bash
is_api_call=false
output_file=""
url_arg=""
prev=""

for arg; do
  [[ "$prev" == "-H" && "$arg" == "Authorization:"* ]] && is_api_call=true
  [[ "$prev" == "-o" ]] && output_file="$arg"
  [[ "$arg" != -* && "$prev" != "-H" && "$prev" != "-o" ]] && url_arg="$arg"
  prev="$arg"
done

if $is_api_call; then
  asset="${url_arg##*/}"
  printf '{"url":"presigned://%s"}\n' "$asset"
else
  asset="${url_arg#presigned://}"
  cp "${FIXTURE_DIR}/${asset}" "$output_file"
fi
EOF
  chmod +x "$MOCK_BIN/curl"
}

# Writes an unzip stub that only creates the -d destination directory.
write_unzip_mock() {
  cat > "$MOCK_BIN/unzip" << 'EOF'
#!/usr/bin/env bash
prev=""
for arg; do
  [[ "$prev" == "-d" ]] && mkdir -p "$arg"
  prev="$arg"
done
EOF
  chmod +x "$MOCK_BIN/unzip"
}

# ── setup / teardown ──────────────────────────────────────────────────────────

setup() {
  MOCK_BIN="$(mktemp -d)"
  ASSETS_DIR="$(mktemp -d)"
  FIXTURE_DIR="$(mktemp -d)"

  export PATH="$MOCK_BIN:$PATH"
  export ASSETS_DIR FIXTURE_DIR
  export BAO_API_KEY="test-license-key"
  export BAO_API_URL="https://api.test.dev"
  export VERSION="v1.0.0"

  setup_fixtures
  write_curl_mock
  write_unzip_mock
}

teardown() {
  rm -rf "$MOCK_BIN" "$ASSETS_DIR" "$FIXTURE_DIR"
}

# ── tests ─────────────────────────────────────────────────────────────────────

@test "downloads and verifies all assets successfully" {
  run bash "$SCRIPT"
  [ "$status" -eq 0 ]
  [ -f "$ASSETS_DIR/worker.js" ]
  [ -f "$ASSETS_DIR/rotation-worker.js" ]
  [ -f "$ASSETS_DIR/migrations.zip" ]
  [ -f "$ASSETS_DIR/tf.zip" ]
  [ -f "$ASSETS_DIR/manifest.json" ]
  [[ "$output" == *"✓"* ]]
  [[ "$output" == *"Assets extracted."* ]]
}

@test "exits when BAO_API_KEY is missing" {
  unset BAO_API_KEY
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"BAO_API_KEY"* ]]
}

@test "exits when BAO_API_URL is missing" {
  unset BAO_API_URL
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"BAO_API_URL"* ]]
}

@test "exits when VERSION is missing" {
  unset VERSION
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"VERSION"* ]]
}

@test "exits when ASSETS_DIR is missing" {
  unset ASSETS_DIR
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"ASSETS_DIR"* ]]
}

@test "exits when API call fails" {
  cat > "$MOCK_BIN/curl" << 'EOF'
#!/usr/bin/env bash
for arg; do
  [[ "$prev" == "-H" && "$arg" == "Authorization:"* ]] && exit 22
  prev="$arg"
done
EOF
  chmod +x "$MOCK_BIN/curl"

  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "exits on hash mismatch" {
  # Tamper with worker.js after fixtures are set up so its hash won't match
  cat > "$MOCK_BIN/curl" << 'EOF'
#!/usr/bin/env bash
is_api_call=false
output_file=""
url_arg=""
prev=""

for arg; do
  [[ "$prev" == "-H" && "$arg" == "Authorization:"* ]] && is_api_call=true
  [[ "$prev" == "-o" ]] && output_file="$arg"
  [[ "$arg" != -* && "$prev" != "-H" && "$prev" != "-o" ]] && url_arg="$arg"
  prev="$arg"
done

if $is_api_call; then
  asset="${url_arg##*/}"
  printf '{"url":"presigned://%s"}\n' "$asset"
else
  asset="${url_arg#presigned://}"
  if [[ "$asset" == "worker.js" ]]; then
    echo "tampered-content" > "$output_file"
  else
    cp "${FIXTURE_DIR}/${asset}" "$output_file"
  fi
fi
EOF
  chmod +x "$MOCK_BIN/curl"

  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"Hash mismatch"* ]]
}
