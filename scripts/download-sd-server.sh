#!/usr/bin/env bash
# Download pre-built sd-server binary for Linux
# Usage: bash scripts/download-sd-server.sh [version]

set -euo pipefail

VERSION="${1:-master-525-d6dd6d7}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/../src-tauri/binaries"
TARGET_TRIPLE="x86_64-unknown-linux-gnu"
OUTPUT_FILE="$OUTPUT_DIR/sd-server-$TARGET_TRIPLE"

if [ -f "$OUTPUT_FILE" ]; then
    echo "sd-server already exists at $OUTPUT_FILE"
    echo "Delete it first if you want to re-download."
    exit 0
fi

mkdir -p "$OUTPUT_DIR"

BASE_URL="https://github.com/leejet/stable-diffusion.cpp/releases/download/$VERSION"

# Extract short hash from version (e.g., "master-525-d6dd6d7" -> "d6dd6d7")
SHORT_HASH=$(echo "$VERSION" | sed 's/.*-//')

# Try multiple naming conventions
ZIP_CANDIDATES=(
    "sd-master-${SHORT_HASH}-bin-Linux-Ubuntu-24.04-x86_64.zip"
    "sd-${VERSION}-bin-Linux-Ubuntu-24.04-x86_64.zip"
    "sd-${VERSION}-bin-linux-avx2-x64.zip"
    "sd-${VERSION}-bin-linux-avx-x64.zip"
    "sd-${VERSION}-bin-linux-noavx-x64.zip"
)

DOWNLOADED=false
TEMP_ZIP=""

for ZIP_NAME in "${ZIP_CANDIDATES[@]}"; do
    DOWNLOAD_URL="$BASE_URL/$ZIP_NAME"
    TEMP_ZIP="/tmp/$ZIP_NAME"

    echo "Trying: $ZIP_NAME..."
    if curl -fSL --progress-bar -o "$TEMP_ZIP" "$DOWNLOAD_URL" 2>/dev/null; then
        echo "Downloaded: $ZIP_NAME"
        DOWNLOADED=true
        break
    else
        echo "  Not found, trying next..."
        rm -f "$TEMP_ZIP"
    fi
done

if [ "$DOWNLOADED" = false ]; then
    echo "ERROR: Could not find any stable-diffusion.cpp release archive for version $VERSION"
    echo "Tried: ${ZIP_CANDIDATES[*]}"
    echo ""
    echo "Check available releases at: https://github.com/leejet/stable-diffusion.cpp/releases"
    echo "Then re-run with: bash $0 <version-tag>"
    exit 1
fi

TEMP_DIR="/tmp/sd-server-extract"

echo "Extracting..."
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
unzip -q "$TEMP_ZIP" -d "$TEMP_DIR"

# Find sd-server binary (prefer sd-server > sd-cli > sd)
SD_BIN=$(find "$TEMP_DIR" -name "sd-server" -type f | head -1)

if [ -z "$SD_BIN" ]; then
    SD_BIN=$(find "$TEMP_DIR" -name "sd-cli" -type f | head -1)
fi

if [ -z "$SD_BIN" ]; then
    SD_BIN=$(find "$TEMP_DIR" -name "sd" -type f -not -path "*/sd-*" | head -1)
fi

if [ -z "$SD_BIN" ]; then
    echo "ERROR: sd / sd-cli binary not found in archive!"
    echo "Contents:"
    find "$TEMP_DIR" -type f | head -20
    exit 1
fi

cp "$SD_BIN" "$OUTPUT_FILE"
chmod +x "$OUTPUT_FILE"
echo "Installed sd-server to: $OUTPUT_FILE"

# Copy libstable-diffusion.so if present
SD_LIB=$(find "$TEMP_DIR" -name "libstable-diffusion.so*" -type f | head -1)
if [ -n "$SD_LIB" ]; then
    LIBNAME=$(basename "$SD_LIB")
    cp "$SD_LIB" "$OUTPUT_DIR/$LIBNAME"
    echo "Copied dependency: $LIBNAME"
else
    # Also try stable-diffusion.so (without lib prefix)
    SD_LIB=$(find "$TEMP_DIR" -name "stable-diffusion.so*" -o -name "libstable_diffusion.so*" -type f | head -1)
    if [ -n "$SD_LIB" ]; then
        LIBNAME=$(basename "$SD_LIB")
        cp "$SD_LIB" "$OUTPUT_DIR/$LIBNAME"
        echo "Copied dependency: $LIBNAME"
    else
        echo "WARNING: No stable-diffusion shared library found in archive — sd-server may not work without it."
    fi
fi

# Copy any other .so files (ggml, etc.) without overwriting existing ones
while IFS= read -r -d '' sofile; do
    SONAME=$(basename "$sofile")
    DEST="$OUTPUT_DIR/$SONAME"
    if [ ! -f "$DEST" ]; then
        cp "$sofile" "$DEST"
        echo "Copied dependency: $SONAME"
    else
        echo "Skipped (already exists): $SONAME"
    fi
done < <(find "$TEMP_DIR" -name "*.so*" -type f -not -name "libstable-diffusion.so*" -not -name "stable-diffusion.so*" -print0)

# Cleanup
rm -rf "$TEMP_DIR"
rm -f "$TEMP_ZIP"

echo ""
echo "Done! sd-server is ready."
