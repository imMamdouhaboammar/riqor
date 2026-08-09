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

Riqor publishes npm packages only from an authenticated local terminal. GitHub Actions may verify and attach release artifacts, but it must never run `npm publish`, `bun publish`, or receive npm publish credentials

Publish prereleases with `npm publish <tarball> --access public --tag beta` and stable releases with `--tag latest`. Do not enable npm provenance in `publishConfig` for this local-only release path because npm provenance generation requires a supported cloud CI environment

After the workflow succeeds, query npm for the published version and dist-tags, download or pack the registry artifact, install it in a clean temporary HOME, and run version, status, doctor, install, and uninstall smoke checks

Compare the registry tarball with the GitHub Release artifact when byte identity is part of the release contract. Do not rewrite existing release tags or historical verification evidence
