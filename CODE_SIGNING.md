# Code Signing Policy

LocalLLM release binaries are signed through the [SignPath Foundation](https://signpath.org/), which provides free code signing for open-source projects.

## What this means

- Release installers are digitally signed, confirming they were built from this repository's source code
- The publisher name shown by Windows is **SignPath Foundation** (they hold the certificate on behalf of open-source projects)
- Signatures are verified against the source code and CI/CD build pipeline — no manual builds

## Team Roles

| Role | Member | Responsibility |
|------|--------|---------------|
| Author / Approver | [@franiumos](https://github.com/franiumos) | Code changes, release approval |

## Build Process

1. A version tag (e.g., `v0.1.0`) is pushed to the `master` branch
2. GitHub Actions builds the installer on `windows-latest`
3. The unsigned installer is submitted to SignPath for signing
4. SignPath verifies the artifact originated from this repository's CI pipeline
5. The signed installer is attached to the GitHub Release

## Privacy & Data Collection

LocalLLM does **not** collect, transmit, or store any user data. Everything runs locally on your machine:

- No telemetry or analytics
- No network calls except to download models from HuggingFace (user-initiated)
- No accounts or sign-ups required
- All conversations and settings are stored locally in `~/.localllm/`

## Verifying Signatures

On Windows, right-click the installer > **Properties** > **Digital Signatures** tab to verify the SignPath Foundation signature.

## Reporting Issues

If you believe a signed binary has been tampered with or violates the signing policy, please report it to [support@signpath.io](mailto:support@signpath.io).

## More Information

- [SignPath Foundation](https://signpath.org/)
- [SignPath Foundation Terms](https://signpath.org/terms.html)
