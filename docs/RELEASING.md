# Releasing Riqor

Use an isolated clean worktree for releases. Do not tag a tree that contains unrelated changes or generated files that have not been inspected.

---

## 🛑 Security Invariant: Local Terminal Publishing Only

> [!IMPORTANT]
> **Publishing to npm via GitHub Actions is strictly prohibited**.
> GitHub Actions workflows (`release.yml`) build tarball artifacts, run verification suites, and attach assets to GitHub Releases, but **NEVER** execute `npm publish`.
> All npm releases MUST be published manually from an authenticated local terminal.

---

## Release Gate Checks

Run these checks locally before creating a version tag or publishing:

```bash
bun install --frozen-lockfile
bun run riqor:runtime:verify
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

Run the committed-runtime check before any build. It is deliberately read-only:
building first can regenerate the payload and hide drift between the checked-in
runtime files and their provenance manifest.

Inspect the generated npm tarball and confirm the root package version, npm package version, release notes, and tag are aligned.

---

## Release Channels

- **Stable versions** (e.g. `0.2.0`) publish to the npm `latest` dist-tag.
- **Prerelease versions** (e.g. `0.2.0-beta.1`) publish to a dist-tag derived from the prerelease identifier (e.g. `beta`).

Before pushing a tag, confirm the tag without its leading `v` exactly matches both package versions.

```bash
# Example local terminal publish for prerelease (beta channel):
cd packages/riqor
npm publish riqor-0.2.0-beta.3.tgz --access public --tag beta

# Example local terminal publish for stable release:
cd packages/riqor
npm publish riqor-0.2.0.tgz --access public --tag latest
```


Do not set `publishConfig.provenance=true` for this terminal-only path. npm provenance generation requires a supported cloud CI runner. Riqor instead records its own packaged file hashes and release evidence, then verifies the registry artifact after publication.

A beta version must not move the npm `latest` dist-tag. Verify both `latest` and the prerelease tag after publishing:

```bash
npm view riqor dist-tags
```

---

## Post-Publish Verification

After publishing via your local terminal, push the release commit and tag only after the registry version is visible. The tag workflow rebuilds the package, downloads `riqor@<version>` from npm, requires byte-for-byte equality, and attaches the registry tarball to the GitHub Release. If npm has not been published first, the GitHub release job fails.

After publishing via your local terminal:

```bash
npm view riqor version dist-tags dist.shasum dist.integrity --json
npm view riqor@<version> version dist.shasum dist.integrity --json
npm pack riqor@<version> --pack-destination <clean-directory> --json
```

Install the registry version into a temporary prefix and run:
```bash
riqor install
riqor version --json
riqor doctor --package-only --json
riqor uninstall --json
```
with a clean `HOME`. Verify the CLI still works when Bun and Codex are absent from `PATH`.

Download the GitHub Release tarball and compare its SHA-256 digest with the registry tarball. The two release channels must carry identical npm tarball bytes.

Homebrew is a separate publication channel. Do not update `Formula/riqor.rb` until the matching Homebrew archive exists and its checksum has been verified.
