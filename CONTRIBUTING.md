# Contributing to LocalLLM

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Download sidecar binaries: `powershell -ExecutionPolicy Bypass -File scripts/download-binaries.ps1`
4. Start dev mode: `npm run tauri dev`

See the [README](README.md) for full setup details.

## Making Changes

1. Create a branch from `main` for your changes
2. Keep commits focused — one logical change per commit
4. Test your changes locally before submitting

## Pull Requests

1. Open a PR against `main`
2. Describe what you changed and why
3. Link any related issues
4. Make sure the app builds without errors (`npm run tauri build`)

## Reporting Bugs

Use the [Bug Report](https://github.com/AugustinMORVAL/LocalLLM/issues/new?template=bug_report.md) issue template. Include:

- Steps to reproduce
- Expected vs actual behavior
- Your OS and GPU info

## Feature Requests

Use the [Feature Request](https://github.com/AugustinMORVAL/LocalLLM/issues/new?template=feature_request.md) issue template.

## Code Style

- TypeScript with strict mode
- React functional components with hooks
- Tailwind CSS for styling
- Zustand for state management
- Keep files small and focused
