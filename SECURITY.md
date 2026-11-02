# Security Policy

## Supported Versions

| Version | Supported |
| :--- | :--- |
| `1.x` (`main`) | :white_check_mark: Yes |

## Architecture & Browser Security Model

- **Zero Backend / Zero Telemetry**: The live showcase on GitHub Pages and the standalone HTML build run 100% client-side in WebGL2 with zero analytics, cookies, or third-party scripts.
- **Strict Content Security Policy (CSP)**: Production web builds enforce `script-src 'self'`, `object-src 'none'`, `base-uri 'none'`, and `connect-src 'self' data: blob:`.
- **Path Traversal Guard**: The local preview server (`scripts/serve.mjs`) strictly normalizes and confines requests to the static serving root on `127.0.0.1`.

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, use GitHub's built-in [**Private Vulnerability Reporting**](https://github.com/bgbg108555/vfx3d-arsenal/security/advisories/new) on this repository. Include:

1. Affected file(s) or build target (`dist/`, standalone HTML, CLI exporter, or Blender script).
2. Minimal reproduction steps or proof-of-concept payload.
3. Expected vs. actual security boundary behavior.

We aim to acknowledge reports within **72 hours** and publish fixes promptly via a coordinated GitHub Security Advisory.
