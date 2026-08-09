---
name: riqor-release
description: Use when an AI coding agent prepares, verifies, publishes, or audits an npm and GitHub release of Riqor.
---

# Riqor Release

Publish only from a clean release commit after the complete gate passes

## Version contract

Keep these values aligned

- root `package.json`
- `packages/riqor/package.json`
- `docs/releases/<version>.md`
- Git tag `v<version>`
- generated package provenance

Prerelease versions such as `0.2.0-beta.1` must publish to their prerelease npm dist-tag, such as `beta`, and GitHub must mark the Release as prerelease. Do not move `latest` until a stable release is intentional

## Required gate

```bash
bun install --frozen-lockfile
bun run riqor:build
bun test
bun run plugin:health
bun run skills:health
bun run riqor:pack
bun run riqor:inspect -- packages/riqor/riqor-*.tgz
bun run riqor:test
bun run actions:verify
bun run backlog:check
bun run release:preflight
```

Review the final diff and security-sensitive boundaries before tagging

## Publishing

Riqor uses npm Trusted Publishing through GitHub Actions OIDC. Do not add a long-lived npm token to the workflow as a shortcut

After the workflow succeeds, query npm for the published version and dist-tags, download or pack the registry artifact, install it in a clean temporary HOME, and run version, status, doctor, install, and uninstall smoke checks

Compare the registry tarball with the GitHub Release artifact when byte identity is part of the release contract. Do not rewrite existing release tags or historical verification evidence
