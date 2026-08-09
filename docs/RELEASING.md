# Releasing Riqor

Use an isolated clean worktree for releases. Do not tag a tree that contains unrelated changes or generated files that have not been inspected.

## Release gate

Run these checks before creating a version tag:

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

Inspect the generated npm tarball and confirm the root package version, npm package version, release notes, and tag are aligned.

## Release channels

Stable versions such as `0.2.0` publish to the npm `latest` dist-tag. Prerelease versions such as `0.2.0-beta.1` publish to a dist-tag derived from the prerelease identifier, so this example publishes to `beta`. The GitHub Release workflow marks prerelease tags as prereleases.

Before pushing a tag, confirm the tag without its leading `v` exactly matches both package versions. The workflow repeats this check and stops before publishing on any mismatch.

A beta must not move npm `latest`. Verify both `latest` and the prerelease tag after publishing.

## npm Trusted Publishing

The release workflow uses npm Trusted Publishing through GitHub Actions OIDC. It does not store a long-lived npm publish token in the workflow.
Configure the `riqor` package on npm with this trusted publisher:

- Provider: GitHub Actions
- Organization or user: `imMamdouhaboammar`
- Repository: `riqor`
- Workflow filename: `release.yml`
- Environment: `npm`
- Allowed action: `npm publish`

The workflow requires `id-token: write` and a GitHub-hosted runner. The repository uses Node.js 22 and pins npm 11.18.0 for release jobs. npm Trusted Publishing requires npm 11.5.1+ and Node.js 22.14.0+. The `npm trust` administration command requires npm 11.15.0+.

With an npm CLI authenticated for account administration, the equivalent setup is:

```bash
npm trust github riqor \
  --file release.yml \
  --repo imMamdouhaboammar/riqor \
  --env npm \
  --allow-publish
```

Trusted Publisher configuration is account-side state. Repository tests can verify the workflow shape but cannot prove that the npm account mapping exists until a publish is attempted.

## Post-publish verification

After npm accepts the version:

```bash
npm view riqor version dist-tags dist.shasum dist.integrity --json
npm view riqor@<version> version dist.shasum dist.integrity --json
npm pack riqor@<version> --pack-destination <clean-directory> --json
```

Install the registry version into a temporary prefix and run `riqor install`, `riqor version --json`, `riqor doctor --package-only --json`, and `riqor uninstall --json` with a clean HOME. Verify the CLI still works when Bun and Codex are absent from PATH.

Download the GitHub Release tarball and compare its SHA-256 digest with the registry tarball. The two release channels must carry identical npm tarball bytes.

Homebrew is a separate publication channel. Do not update `Formula/riqor.rb` until the matching Homebrew archive exists and its checksum has been verified.
