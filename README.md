# LocalLLM

A desktop application for running large & small language models and image generation locally on your PC.

Built with [Tauri 2](https://v2.tauri.app/) (Rust backend) + React 19 + TypeScript.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-lightgrey)
![Linux](https://img.shields.io/badge/Linux-coming%20soon-orange)

**I HEAVILY RECOMMEND OPENING GUIDE.PDF FROM THE REPO TO LEARN MORE ABOUT LOCAL LLM, LEARN HOW TO INSTALL IT AND USE IT, IT IS MUCH SIMPLER THAN THE TUTORIAL BELOW**

## Features

- Chat system
- Code agent that reads and creates files for you
- Image generation tool "Pixara" that uses LLMs to generate pictures
- Model Library with 50+ available LLMs of all kind (lightweight models, code specialized models, ...).
- Model Advisor : system that helps you find the best model for your hardware and use case
- Load models in RAM, VRAM or both

## Installation

### For Users

Download the latest installer from the [Releases](https://github.com/franiumos/LocalLLM/releases) page and run it. No prerequisites needed everything is bundled.

**GPU** (optional but recommended) Vulkan-capable GPU for accelerated inference

> **Linux support is coming soon!** A `.deb` and `.AppImage` build is in progress.

### For Developers

To build from source, you need:

**Node.js** 18+ and npm
**Rust** toolchain (install via [rustup](https://rustup.rs/))

## Quick Start (Development)

```bash
# 1. Clone the repository
git clone https://github.com/franiumos/LocalLLM.git
cd LocalLLM

# 2. Install Node.js dependencies
npm install

# 3. Download sidecar binaries (llama-server + sd-server + DLLs)
powershell -ExecutionPolicy Bypass -File scripts/download-binaries.ps1

# 4. Run in development mode
npm run tauri dev
```

## Download Scripts

The sidecar binaries (inference servers + DLLs) are **not** included in this repository due to their size (~160 MB). They are downloaded automatically by the setup script.

| Script | What it does |
|--------|-------------|
| `scripts/download-binaries.ps1` | **All-in-one** — downloads llama-server, sd-server, and all required DLLs |
| `scripts/download-llama-server.ps1` | Downloads only llama-server + GGML DLLs from [llama.cpp releases](https://github.com/ggml-org/llama.cpp/releases) |
| `scripts/download-sd-server.ps1` | Downloads only sd-server + stable-diffusion.dll from [stable-diffusion.cpp releases](https://github.com/leejet/stable-diffusion.cpp/releases) |

After running the download script, `src-tauri/binaries/` should contain:
```
llama-server-x86_64-pc-windows-msvc.exe
sd-server-x86_64-pc-windows-msvc.exe
llama.dll, ggml.dll, ggml-base.dll, ggml-vulkan.dll, ggml-cpu-*.dll, ...
stable-diffusion.dll
```

## Building

```bash
# Build the Classic installer
npm run build:classic

# Build the "Aero" style installer
npm run build:aero

# Build both variants
npm run build:all
```

Installers are output to `build_installator/`.

## Project Structure

```
LocalLLM/
├── src/                        # React frontend
│   ├── app/routes/             #   Page components (chat, models, library, settings)
│   ├── features/               #   Feature modules (chat, code, pixara, models, library, settings)
│   ├── components/             #   Shared UI components (sidebar, titlebar, layout)
│   ├── lib/                    #   Constants, utilities, variant config
│   └── styles/                 #   Tailwind CSS (dark, light, aero themes)
├── src-tauri/                  # Rust backend (Tauri 2)
│   ├── src/commands/           #   IPC command handlers
│   ├── src/services/           #   Business logic (inference, downloads, GPU detection)
│   ├── src/models/             #   Data structures
│   ├── binaries/               #   Sidecar executables + DLLs (gitignored, downloaded by script)
│   └── tauri.conf.json         #   Tauri app configuration
├── catalog/
│   └── models.json             #   Curated model catalog (50+ models with quality scores)
├── scripts/                    #   Build & setup scripts
└── package.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite 7 |
| Backend | Rust, Tauri 2 |
| State | Zustand |
| Database | SQLite (via rusqlite) |
| LLM Inference | [llama.cpp](https://github.com/ggml-org/llama.cpp) (llama-server sidecar) |
| Image Gen | [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp) (sd-server sidecar) |
| GPU | Vulkan (via ggml-vulkan), CUDA optional |

## Supported Models

The built-in catalog includes 50+ models across these categories:

| Category | Examples |
|----------|---------|
| Chat | Llama 3.3 70B, Gemma 3 (1B–27B), Qwen 2.5, Mistral Small 24B |
| Code | Qwen 2.5 Coder, Codestral 22B, Code Llama |
| Reasoning | DeepSeek R1 Distill, Phi-4 14B, QwQ 32B |
| Vision | Qwen2-VL (2B/7B), LLaVA 1.6 |
| Image Generation | Stable Diffusion 3.5 Medium, SDXL |
| Multilingual | Aya Expanse (8B/32B) |

Models are downloaded on demand from HuggingFace in GGUF format to `~/.localllm/models/`.

## License

MIT See [LICENSE](LICENSE) for details.

Bundled sidecar binaries are from open-source projects under MIT license:
[llama.cpp](https://github.com/ggml-org/llama.cpp) — MIT License
[stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp) — MIT License

## Credits

Help : support@franiumsoftwares.com

© Franium Softwares 2026
