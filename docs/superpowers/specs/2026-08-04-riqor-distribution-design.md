# Riqor Distribution Design

Date: 2026-08-04
Status: Ready for implementation review
Repository source: `/Users/mamdouhaboammar/Documents/codex-self-improvement-harness`
Public product name: `Riqor`

## Product position

Riqor adds automatic hooks, verification gates, curated workflows, and local session continuity to AI coding agents

Primary line

`AI agents should prove the work`

Primary README headline

`Your coding agent said it was done`

`Riqor checks the evidence`

## Goals

- Publish a public GitHub repository at `imMamdouhaboammar/riqor`
- Install the CLI with `npx riqor install`
- Install the CLI with `brew install imMamdouhaboammar/tap/riqor`
- Preserve the existing Codex Plugin and local hooks
- Keep the original `codex` and `kaku` executables untouched
- Provide deterministic packaging, rollback, doctor, and uninstall flows
- Present honest claims backed by current test and smoke evidence

## Considered approaches

### Recommended: distribution package inside the existing repository

Create `packages/riqor` as the publishable npm package and generate its runtime payload from the tested root source

This keeps public distribution isolated while preserving one canonical repository and one test history

### Alternative: publish the repository root

This requires fewer files but makes npm packaging depend on a large exclusion list and increases the risk of publishing development content

### Alternative: separate distribution repository

This gives strong isolation but duplicates release logic, creates version drift, and weakens traceability between source tests and published artifacts

The implementation will use `packages/riqor` with an explicit files allowlist and packed-tarball tests

## Public package identity

| Surface | Identifier |
|---|---|
| GitHub repository | `imMamdouhaboammar/riqor` |
| npm package | `riqor` |
| npm binary | `riqor` |
| Homebrew formula | `riqor` |
| Homebrew tap | `imMamdouhaboammar/homebrew-tap` |
| Codex Plugin display name | `Riqor Agent Runtime` |
| Existing plugin selector | `codex-self-improvement@codex-self-improvement-dev` during migration |

Before creating public resources, the release preflight verifies that the GitHub repository, npm package, and Homebrew Formula identifiers are available or owned by the user

The first public release keeps the current plugin selector internally to avoid breaking installed sessions

A later migration may publish a renamed marketplace selector after explicit compatibility tests

## Command surface

```bash
riqor install
riqor doctor
riqor status
riqor paths list
riqor plugin status
riqor plugin install
riqor shell status
riqor codex
riqor uninstall
```

Compatibility aliases remain available during the first public release

```bash
codex-harness
cxh
```

## Package architecture

The public npm package is a thin distribution wrapper around the tested repository runtime

It contains

- A portable `riqor` executable
- Compiled or directly executable runtime files
- The Codex Plugin source
- Shell integration templates
- Install, doctor, status, rollback, and uninstall commands
- Version and provenance metadata

It excludes

- Test fixtures
- Benchmark work directories
- Authentication files
- Local state
- Build caches
- Finder metadata
- Machine-specific paths

The npm package must run through `npx` without cloning the repository

Global npm installation must expose the same executable and behavior

## npm installation flow

`npx riqor install` performs these steps

1. Detect macOS, Linux, shell, Codex, and Kaku availability
2. Install the packaged Codex Plugin into the active `CODEX_HOME`
3. Install the `riqor` executable and compatibility aliases
4. Add bounded shell environment loading
5. Add Kaku hooks only when Kaku integration exists
6. Run Riqor health checks
7. Print installed surfaces, version, and rollback command

## Homebrew distribution

The Homebrew Formula installs the npm package artifact or a release tarball with a pinned SHA-256 digest

Preferred Formula behavior

- Depend on a supported Node runtime when the packaged artifact requires Node
- Install `riqor` into the Homebrew prefix
- Keep all runtime assets under `libexec`
- Link only the public executable and compatibility aliases
- Run `riqor version` and `riqor doctor --package-only` in the Formula test block
- Avoid editing user shell files during `brew install`

User environment changes happen only after

```bash
riqor install
```

This keeps Homebrew installation reversible and avoids hidden mutations

## GitHub repository

The public repository uses the existing project history and becomes the canonical source for Riqor

Required repository files

- Marketing `README.md`
- `LICENSE`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- npm package metadata
- Homebrew release instructions
- GitHub Actions for test, package, release, and provenance checks
- Issue templates for bug reports, integrations, and good first issues

## Marketing README structure

1. Product name and one-line value
2. The reliability problem Riqor addresses
3. A compact terminal example showing mutation and verification state
4. Supported surfaces and exact boundaries
5. Two installation methods
6. First-run command
7. Core commands
8. How evidence gates work
9. Privacy and local state guarantees
10. Current verification results
11. Known limitations
12. Uninstall and rollback
13. Contributing and security reporting

Claims must remain tied to current evidence

The README must not claim model modification, deterministic AI behavior, universal ChatGPT runtime injection, or open-world superiority

## Release flow

A tagged release performs these steps

1. Run the complete repository test suite
2. Run plugin validator and package health
3. Rebuild curated skills from pinned revisions
4. Build the npm package with an allowlist
5. Run installation tests from the packed tarball
6. Build the deterministic Plugin ZIP
7. Create checksums and provenance metadata
8. Publish the GitHub release
9. Publish npm after artifact verification
10. Update the Homebrew Formula with the release URL and SHA-256

A failure at any stage stops publishing

## Error handling and rollback

Install commands must fail with a clear reason and leave prior working files intact

Required protections

- Verify an existing marketplace name also points to the expected source
- Back up managed shell files before replacement
- Restore prior files when post-install health fails
- Never remove files not recorded in the Riqor install manifest
- Avoid replacing `codex`, `kaku`, `node`, or package-manager executables
- Keep uninstall safe to run repeatedly
- Separate Riqor failures from unrelated Codex or MCP warnings

## Security and privacy

- Package publishing uses npm trusted publishing or a scoped automation token stored only in GitHub Actions secrets
- GitHub release workflows use minimal permissions
- Third-party Actions are pinned to commit SHAs
- Release artifacts exclude credentials, prompts, command text, source contents, repository paths, and local state
- Temporary authentication links are always removed through cleanup blocks
- Shell tracking stores bounded hashes and result metadata only
- Marketplace source verification occurs before Plugin installation

## Test strategy

Required test groups

- CLI argument and exit-code tests
- `npm pack` allowlist and archive inspection
- Installation in temporary HOME and CODEX_HOME directories
- npm local tarball installation
- Homebrew Formula syntax and test block
- Shell install, repeated install, uninstall, and rollback
- Kaku interactive and ordinary command behavior
- Plugin validator, hook smoke, state concurrency, and abandoned lease recovery
- Clean repository and generated artifact checks

## Acceptance criteria

- `npx riqor version` works from a clean temporary directory
- `npx riqor install` installs and verifies the Plugin without repository checkout
- `npm install -g riqor` exposes `riqor`, `codex-harness`, and `cxh`
- `brew install imMamdouhaboammar/tap/riqor` installs the same released version
- `riqor doctor` reports the Plugin, shell, Kaku, and external Codex observations separately
- Codex App, Codex CLI, and ChatGPT bundled Codex see the same enabled Plugin
- Kaku starts with no warnings and ordinary commands do not invoke the runtime
- Uninstall restores managed shell files and leaves unrelated configuration intact
- The npm tarball and Plugin ZIP contain no unwanted or credential-shaped files
- GitHub release, npm package, Formula, checksums, and documented version match
- The public repository passes all required checks with a clean working tree

## Initial release scope

The first public release targets macOS and Linux with zsh support

Kaku integration is enabled on macOS when its managed files are present

Additional shells and agent integrations remain later work unless already supported by the existing runtime

## Non-goals

- Changing model weights
- Claiming deterministic model output
- Injecting local code into hosted ChatGPT conversations
- Starting background daemons by default
- Publishing durable learning without explicit approval
- Automatically editing production credentials or external services
- Replacing package-manager or agent executables

## Recommended implementation order

1. Add Riqor compatibility names and portable package boundaries
2. Add npm package and packed-tarball tests
3. Add public documentation and repository files
4. Add release workflows
5. Create and push the GitHub repository
6. Publish the npm package
7. Create or update the Homebrew tap and Formula
8. Run installation verification from both distribution channels
