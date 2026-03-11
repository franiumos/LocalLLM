#!/usr/bin/env bash
# Build LocalLLM for Linux (run from WSL or native Linux)
# Usage: bash scripts/build-linux.sh
#
# Prerequisites (Ubuntu/Debian):
#   sudo apt install build-essential curl wget file unzip \
#     libwebkit2gtk-4.1-dev libssl-dev libayatana-appindicator3-dev \
#     librsvg2-dev libxdo-dev patchelf libfuse2
#   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
#   source "$HOME/.cargo/env"
#   # Node.js 22:
#   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
#   sudo apt install -y nodejs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "========================================"
echo "  LocalLLM — Linux Build"
echo "========================================"
echo ""

# ---- Check prerequisites ----
MISSING=()

if ! command -v cargo &>/dev/null; then
    MISSING+=("cargo (install via https://rustup.rs/)")
fi
if ! command -v node &>/dev/null; then
    MISSING+=("node (install via https://deb.nodesource.com/setup_22.x)")
fi
if ! command -v npm &>/dev/null; then
    MISSING+=("npm (comes with Node.js)")
fi

if [ ${#MISSING[@]} -gt 0 ]; then
    echo "ERROR: Missing prerequisites:"
    for m in "${MISSING[@]}"; do
        echo "  - $m"
    done
    echo ""
    echo "See the script header for install commands."
    exit 1
fi

echo "  cargo: $(cargo --version)"
echo "  node:  $(node --version)"
echo "  npm:   $(npm --version)"
echo ""

# ---- Warn about /mnt/c/ performance ----
if [[ "$ROOT" == /mnt/* ]]; then
    echo "WARNING: Building on a Windows mount (/mnt/c/) is very slow."
    echo "For much faster builds, copy the project to the native Linux filesystem:"
    echo "  cp -r \"$ROOT\" ~/LocalLLM && cd ~/LocalLLM"
    echo ""
    read -p "Continue anyway? [y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# ---- Download sidecar binaries if missing ----
TARGET_TRIPLE="x86_64-unknown-linux-gnu"
if [ ! -f "$ROOT/src-tauri/binaries/llama-server-$TARGET_TRIPLE" ]; then
    echo "Sidecar binaries not found. Downloading..."
    bash "$SCRIPT_DIR/download-binaries.sh"
    echo ""
fi

# ---- Install Node.js dependencies ----
echo "Installing Node.js dependencies..."
cd "$ROOT"
npm install

# ---- Build with Tauri ----
echo ""
echo "Building LocalLLM (Classic variant)..."
VITE_APP_VARIANT=classic npm run tauri build

# ---- Collect output ----
LINUX_OUT="$ROOT/linux"
mkdir -p "$LINUX_OUT"

BUNDLE_DIR="$ROOT/src-tauri/target/release/bundle"
FOUND=0

# Copy .deb packages
if [ -d "$BUNDLE_DIR/deb" ]; then
    for f in "$BUNDLE_DIR/deb"/*.deb; do
        [ -f "$f" ] || continue
        cp "$f" "$LINUX_OUT/"
        echo "  Copied: $(basename "$f")"
        FOUND=$((FOUND + 1))
    done
fi

# Copy .AppImage packages
if [ -d "$BUNDLE_DIR/appimage" ]; then
    for f in "$BUNDLE_DIR/appimage"/*.AppImage; do
        [ -f "$f" ] || continue
        cp "$f" "$LINUX_OUT/"
        echo "  Copied: $(basename "$f")"
        FOUND=$((FOUND + 1))
    done
fi

echo ""
if [ "$FOUND" -gt 0 ]; then
    echo "========================================"
    echo "  Build complete! $FOUND installer(s) in:"
    echo "  $LINUX_OUT"
    echo "========================================"
    ls -lh "$LINUX_OUT/"
else
    echo "WARNING: No installers found in $BUNDLE_DIR"
    echo "Check the build output above for errors."
    exit 1
fi
