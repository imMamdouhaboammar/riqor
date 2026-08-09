# Security Policy

Riqor changes local shell files, launches managed Codex child processes, runs lifecycle hooks, and stores bounded local state. Security reports are reviewed against those local trust boundaries.

For implementation details, read the [Security Model](docs/SECURITY_MODEL.md).

## Supported Versions

| Version | Security support |
| --- | --- |
| `0.2.0-beta.x` | Beta security support |
| `0.1.x` | Supported stable |
| Older or unreleased builds | Best effort only |

Security fixes are prepared for the latest supported release line. Report the exact version or commit you tested.

## Report a Vulnerability

Do not open a public issue, discussion, or pull request for a suspected vulnerability.

Use [GitHub Private Vulnerability Reporting](https://github.com/imMamdouhaboammar/riqor/security/advisories/new).

Include:

- affected version or commit
- operating system and local environment
- affected command, hook, installer, or state path
- reproduction steps
- expected and observed behavior
- security impact
- proof of concept when it can be shared safely
- suggested mitigation when available

Remove credentials, access tokens, private source, personal paths, and unrelated user data from the report.

## Response Process

The project aims to acknowledge a complete report within 48 hours.

The maintainer may ask for additional evidence, confirm the affected scope, prepare a private fix, add regression tests, and coordinate disclosure after a supported release is available.

Response time and release timing may vary with severity, reproduction quality, affected platforms, and maintainer availability.

## In-Scope Examples

Examples include:

- command injection or unsafe shell invocation
- activator scope escaping the managed Codex child process
- path traversal or unsafe symlink handling
- unsafe file permissions
- sensitive content retained in local state against the documented contract
- state corruption that creates repeated blocking or unsafe execution
- lock behavior that permits cross-session state confusion
- installer or uninstaller behavior that modifies unrelated user files
- release artifact or provenance problems
- credential exposure in logs, artifacts, documentation, or diagnostics

## Usually Out of Scope

These are usually not security vulnerabilities unless they cross a documented trust boundary:

- model quality or an incorrect coding suggestion
- a repository test that fails to detect a semantic bug
- missing support for an undocumented platform
- denial of service that requires an already compromised local user account
- behavior inside a hosted ChatGPT conversation where Riqor does not run
- Codex provider or service behavior outside the Riqor runtime

## Disclosure

Please allow time to validate and address the report before public disclosure. Credit can be included in release notes when requested and appropriate.

Do not test against systems or accounts you do not own or have explicit permission to assess.
