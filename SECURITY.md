# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in LocalLLM, please report it responsibly.

**Do not open a public issue.**

Instead, send an email to the maintainers with:

1. A description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

We will acknowledge your report within 48 hours and work on a fix as quickly as possible.

## Scope

LocalLLM runs entirely locally. Security concerns primarily involve:

- **Sidecar binaries** (llama-server, sd-server) — these are downloaded from official GitHub releases of open-source projects
- **Local file access** — the app reads/writes model files and conversations to `~/.localllm/`
- **Shell command execution** — Code Mode can execute commands in a user-selected working directory

## Best Practices

- Only download models from trusted sources (the built-in catalog uses HuggingFace)
- Review shell commands before executing them in Code Mode
- Keep the app updated to the latest version
