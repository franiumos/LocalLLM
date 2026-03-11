#!/usr/bin/env bash
# Download all sidecar binaries for Linux (llama-server + sd-server + shared libs)
# Usage: bash scripts/download-binaries.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/../src-tauri/binaries"

echo "========================================"
echo "  LocalLLM — Linux Binary Downloader"
echo "========================================"
echo ""

# Check for required tools
for cmd in curl unzip; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "ERROR: '$cmd' is required but not installed."
        echo "Install it with: sudo apt install $cmd"
        exit 1
    fi
done

mkdir -p "$OUTPUT_DIR"

echo "--- Downloading llama-server ---"
bash "$SCRIPT_DIR/download-llama-server.sh" "$@"

echo ""
echo "--- Downloading sd-server ---"
bash "$SCRIPT_DIR/download-sd-server.sh"

echo ""
echo "========================================"
echo "  Verification"
echo "========================================"

TARGET_TRIPLE="x86_64-unknown-linux-gnu"
ERRORS=0

for bin in "llama-server-$TARGET_TRIPLE" "sd-server-$TARGET_TRIPLE"; do
    if [ -f "$OUTPUT_DIR/$bin" ]; then
        echo "  OK: $bin"
    else
        echo "  MISSING: $bin"
        ERRORS=$((ERRORS + 1))
    fi
done

SO_COUNT=$(find "$OUTPUT_DIR" -name "*.so*" 2>/dev/null | wc -l)
echo "  Shared libraries: $SO_COUNT file(s)"

echo ""
if [ "$ERRORS" -gt 0 ]; then
    echo "WARNING: $ERRORS binary file(s) missing. Check the output above for errors."
    exit 1
else
    echo "All binaries downloaded successfully!"
fi
