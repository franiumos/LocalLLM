# Build Guide

## Prerequisites

- **Node.js** 18+ and npm
- **Rust** toolchain (install via [rustup](https://rustup.rs/))
- **Windows 10/11 (x64)** or **Linux**

## Setup

```bash
# 1. Clone the repository
git clone https://github.com/AugustinMORVAL/LocalLLM.git
cd LocalLLM

# 2. Install Node.js dependencies
npm install

# 3. Download sidecar binaries
powershell -ExecutionPolicy Bypass -File scripts/download-binaries.ps1
```

## Development

```bash
npm run tauri dev
```

This starts the app in development mode with hot reload.

## Production Build

```bash
# Build the Classic variant (dark/light theme)
npm run build:classic

# Build the Aero variant (glass theme for FraniumOS)
npm run build:aero

# Build both variants
npm run build:all
```

Installers are output to `build_installator/`.

## Build Variants

| Command | Variant | Theme |
|---|---|---|
| `npm run build:classic` | Classic | Dark/Light solid UI |
| `npm run build:aero` | Aero | Translucent glass UI |

## Download Scripts

If you need to download sidecar binaries individually:

| Script | What it does |
|---|---|
| `scripts/download-binaries.ps1` | All-in-one: downloads everything |
| `scripts/download-llama-server.ps1` | llama-server + GGML DLLs from [llama.cpp](https://github.com/ggml-org/llama.cpp/releases) |
| `scripts/download-sd-server.ps1` | sd-server + stable-diffusion.dll from [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp/releases) |

## Expected Binaries

After running the download script, `src-tauri/binaries/` should contain:

```
llama-server-x86_64-pc-windows-msvc.exe
sd-server-x86_64-pc-windows-msvc.exe
llama.dll
ggml.dll
ggml-base.dll
ggml-vulkan.dll
ggml-cpu-*.dll
stable-diffusion.dll
```

## Troubleshooting

- **Rust not found** — Install via [rustup.rs](https://rustup.rs/)
- **Missing DLLs at runtime** — Re-run `scripts/download-binaries.ps1`
- **Build fails on linking** — Make sure Visual Studio Build Tools are installed (Windows)
- **GPU not detected** — Ensure Vulkan drivers are installed for your GPU
