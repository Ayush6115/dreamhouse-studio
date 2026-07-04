# Security Policy

## Scope

DreamHouse Studio is a fully client-side application: it has no server component, no authentication, and stores all project data in the browser's localStorage. The primary security surfaces are:

- Parsing of imported `.dreamhouse.json` project files
- Rendering of user-provided text (project names, room names, annotations) into the DOM and into generated SVG/PDF exports
- The asset-fetch script (`scripts/fetch-assets.mjs`), which downloads binaries from Poly Haven and ambientCG over HTTPS

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x | Yes |
| < 1.0 | No |

## Reporting a vulnerability

Please do **not** open a public issue for security problems.

Report vulnerabilities privately via GitHub's **Security Advisories** ("Report a vulnerability" on the repository's Security tab). Include reproduction steps and, where applicable, a proof-of-concept project file.

You can expect an acknowledgment within one week. Once a fix is available, we will coordinate a disclosure timeline with you and credit you in the release notes unless you prefer otherwise.
