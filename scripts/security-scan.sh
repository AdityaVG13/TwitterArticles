#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cd "$ROOT_DIR"

echo "== npm audit =="
npm run audit

echo "== package artifact =="
npm pack --json --pack-destination "$TMP_DIR" > "$TMP_DIR/pack.json"
TARBALL="$(
  node -e 'const fs = require("fs"); const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); console.log(data[0].filename);' "$TMP_DIR/pack.json"
)"
ARTIFACT="$TMP_DIR/$TARBALL"
SHA256="$(shasum -a 256 "$ARTIFACT" | cut -d " " -f 1)"
echo "artifact=$TARBALL"
echo "sha256=$SHA256"

if command -v freshclam >/dev/null 2>&1 && [ "${XAD_UPDATE_CLAMAV:-0}" = "1" ]; then
  echo "== freshclam =="
  freshclam
fi

if command -v clamscan >/dev/null 2>&1; then
  echo "== ClamAV artifact scan =="
  clamscan --version
  clamscan --infected "$ARTIFACT"

  echo "== ClamAV unpacked package scan =="
  mkdir "$TMP_DIR/unpacked"
  tar -xzf "$ARTIFACT" -C "$TMP_DIR/unpacked"
  clamscan -r --infected "$TMP_DIR/unpacked/package"
else
  echo "SKIP ClamAV: clamscan not found"
fi

if command -v semgrep >/dev/null 2>&1; then
  echo "== Semgrep security scan =="
  semgrep scan --config p/secrets --config p/javascript --error --quiet
else
  echo "SKIP Semgrep: semgrep not found"
fi

echo "security scan complete"
