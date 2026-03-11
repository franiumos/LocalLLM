#!/usr/bin/env bash
# Download pre-built llama-server binary for Linux
# Usage: bash scripts/download-llama-server.sh [version]

set -euo pipefail

VERSION="${1:-b8272}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/../src-tauri/binaries"
TARGET_TRIPLE="x86_64-unknown-linux-gnu"
OUTPUT_FILE="$OUTPUT_DIR/llama-server-$TARGET_TRIPLE"

if [ -f "$OUTPUT_FILE" ]; then
    echo "llama-server already exists at $OUTPUT_FILE"
    echo "Delete it first if you want to re-download."
    exit 0
fi

mkdir -p "$OUTPUT_DIR"

BASE_URL="https://github.com/ggml-org/llama.cpp/releases/download/$VERSION"

# Try multiple archive naming conventions (tar.gz for Linux, zip as fallback)
ARCHIVE_CANDIDATES=(
    "llama-${VERSION}-bin-ubuntu-x64.tar.gz"
    "llama-${VERSION}-bin-linux-x64.tar.gz"
    "llama-${VERSION}-bin-ubuntu-x64.zip"
    "llama-${VERSION}-bin-linux-x64.zip"
)

DOWNLOADED=false
TEMP_ARCHIVE=""
IS_TAR=false

for ARCHIVE_NAME in "${ARCHIVE_CANDIDATES[@]}"; do
    DOWNLOAD_URL="$BASE_URL/$ARCHIVE_NAME"
    TEMP_ARCHIVE="/tmp/$ARCHIVE_NAME"

    echo "Trying: $ARCHIVE_NAME..."
    if curl -fSL --progress-bar -o "$TEMP_ARCHIVE" "$DOWNLOAD_URL" 2>/dev/null; then
        echo "Downloaded: $ARCHIVE_NAME"
        DOWNLOADED=true
        [[ "$ARCHIVE_NAME" == *.tar.gz ]] && IS_TAR=true
        break
    else
        echo "  Not found, trying next..."
        rm -f "$TEMP_ARCHIVE"
    fi
done

if [ "$DOWNLOADED" = false ]; then
    echo "ERROR: Could not find any llama.cpp release archive for version $VERSION"
    echo "Tried: ${ARCHIVE_CANDIDATES[*]}"
    echo ""
    echo "Check available releases at: https://github.com/ggml-org/llama.cpp/releases"
    echo "Then re-run with: bash $0 <version-tag>"
    exit 1
fi

TEMP_DIR="/tmp/llama-server-extract"

echo "Extracting..."
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

if [ "$IS_TAR" = true ]; then
    tar xzf "$TEMP_ARCHIVE" -C "$TEMP_DIR"
else
    unzip -q "$TEMP_ARCHIVE" -d "$TEMP_DIR"
fi

# Find llama-server binary in extracted files
SERVER_BIN=$(find "$TEMP_DIR" -name "llama-server" -type f | head -1)

if [ -z "$SERVER_BIN" ]; then
    echo "ERROR: llama-server not found in archive!"
    echo "Contents:"
    find "$TEMP_DIR" -type f | head -20
    exit 1
fi

cp "$SERVER_BIN" "$OUTPUT_FILE"
chmod +x "$OUTPUT_FILE"
echo "Installed llama-server to: $OUTPUT_FILE"

# Copy all .so shared libraries
COPIED_COUNT=0
while IFS= read -r -d '' sofile; do
    SONAME=$(basename "$sofile")
    cp "$sofile" "$OUTPUT_DIR/$SONAME"
    echo "Copied dependency: $SONAME"
    COPIED_COUNT=$((COPIED_COUNT + 1))
done < <(find "$TEMP_DIR" -name "*.so*" -type f -print0)

# Validate critical shared libs
CRITICAL_LIBS=("libllama.so" "libggml.so" "libggml-base.so")
MISSING=()
for lib in "${CRITICAL_LIBS[@]}"; do
    if ! find "$OUTPUT_DIR" -name "$lib*" | grep -q .; then
        MISSING+=("$lib")
    fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
    echo "WARNING: Missing critical libraries: ${MISSING[*]}"
    echo "llama-server may not run without these. Check the archive contents."
else
    echo "All critical shared libraries found."
fi

echo ""
echo "Summary: copied $COPIED_COUNT shared library file(s)"

# Cleanup
rm -rf "$TEMP_DIR"
rm -f "$TEMP_ARCHIVE"

echo "Done! llama-server is ready."
