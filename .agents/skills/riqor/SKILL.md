---
name: riqor-conventions
description: Use when changing, testing, packaging, installing, uninstalling, diagnosing, or releasing the Riqor repository or its npm distribution.
---

# Riqor Conventions

## Core rule

Riqor makes completion claims depend on observable evidence. Apply the same standard to Riqor itself: reproduce failures, add a regression test, fix the smallest responsible boundary, and run fresh verification before release claims.

## Runtime boundaries

Keep these surfaces distinct:

- Repository development may use Bun
- The published `riqor` package requires Node.js 22+, Python 3 for shell integration, and Codex only for Codex features
- Published install, uninstall, shell, and plugin lifecycle commands must not require Bun
- Packaged commands must resolve files from the packaged runtime, not from repository-only paths
- Hosted ChatGPT is outside the local Riqor runtime boundary

## Filesystem safety

Before replacing a user path, classify ownership. Known Riqor and recognized legacy-managed paths may be migrated. Unknown paths must be preserved and reported.

Never follow a symlink and then overwrite its target during install. Never recursively remove a data root merely because its name matches Riqor. Remove only validated Riqor-owned payload directories and managed files.

## Package integrity

`runtime/provenance.json` is a verification input, not decoration. Package diagnostics must validate version, safe relative paths, regular-file type, byte size, SHA-256 digest, missing files, and unexpected files.

Exclude operating-system metadata such as `.DS_Store`, `Thumbs.db`, and AppleDouble `._*` files from runtime and plugin archives.

## Shell configuration

Managed shell markers are a user-file boundary. Unmatched, nested, or out-of-order markers must fail closed before rewriting `.zshenv`. Package mode must not create development wrappers that can replace the `riqor` shim.

Respect `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, and `XDG_STATE_HOME`. Tests using a custom home must not leak writes into the developer's real XDG paths.

## Required regression coverage

For installer or packaging changes, cover at least:

- clean install and idempotent uninstall
- foreign executable preservation
- recognized legacy migration
- package mode without Bun
- Codex plugin lifecycle with isolated `CODEX_HOME`
- provenance tampering and path traversal
- malformed shell markers
- archive content inspection

Prefer temporary homes and mock external CLIs where behavior can be isolated.

## Release gate

Do not tag or publish from a dirty or shared worktree. Use an isolated branch and verify the exact release tree.

Run the complete release checks, including:

```bash
bun test
bun run plugin:health
bun run skills:health
bun run riqor:pack
bun run riqor:inspect -- packages/riqor/riqor-*.tgz
bun run riqor:test
bun run actions:verify
bun run release:preflight
```

Inspect `npm pack --dry-run` or the generated tarball before publishing. After publication, query npm again and run the published package in a clean temporary home.

Keep the root and npm package versions aligned. Release notes must exist for that npm version. Homebrew is a separate publication channel and its formula must remain internally consistent with the artifact it actually references.

Never rewrite historical release evidence to hide a discovered defect. Record a correction and identify the release that fixes it.
