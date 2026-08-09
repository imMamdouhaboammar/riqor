# Changelog

All notable changes to Riqor are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-08-09

### Added

- Bundled all 101 repository Codex subagent configs as native role files in the Riqor plugin and npm runtime
- Added an isolated Riqor Codex profile that registers the bundled roles without apps, MCP servers, or tool configuration

### Fixed

- Repaired a malformed control escape in the Mobile App Builder agent so every bundled role parses as TOML
- Made `riqor codex` activate the managed Riqor profile without overriding an explicit user-selected profile
- Preserved foreign Codex profile paths during install and uninstall instead of overwriting user configuration

## [0.2.0] - 2026-08-09

### Added

- Stable npm release with the Riqor Codex plugin and focused skill pack
- New Riqor brand mark and plugin artwork built around the verification check

### Changed

- Reworked the public and npm README around the product problem, quick start, Codex plugin, evidence flow, and local privacy boundary
- Promoted the tested `0.2.0` feature line to npm `latest` so `npm install riqor` resolves to the current release
- Kept npm publication terminal-only while GitHub verifies and attaches the registry artifact

## [0.2.0-beta.3] - 2026-08-09

### Changed

- Published the Codex plugin under the public `riqor` identity and `riqor` repository marketplace
- Added the complete Riqor skill pack plus explicit package setup/upgrade guidance
- Switched distributed plugin hooks to Node 22 and removed the installed-plugin Bun dependency
- Enforced terminal-only npm publication and removed CI-only npm provenance configuration
- Made the tag workflow fetch the already-published npm tarball, compare it byte-for-byte with the release build, and attach the registry artifact to GitHub Release

## [0.2.0-beta.2] - 2026-08-09

### Added

- Divio-structured tutorials, how-to guides, reference pages, and explanation pages for the public documentation hub
- A refreshed public README and documentation index with explicit local-runtime and hosted-ChatGPT boundaries

### Changed

- Refreshed the Codex plugin distribution metadata and marketplace-backed release surface
- Kept the beta release on npm's `beta` dist-tag without moving the stable `latest` channel or Homebrew formula

## [0.2.0-beta.1] - 2026-08-09

### Added

- Managed Google Antigravity (`agy` or `antigravity`) session launch with the same bounded activator timing model used by managed Codex sessions
- Canonical Riqor Skills Pack for core operation, evidence runs, managed Codex, diagnostics, security, and release work, bundled into the npm runtime and covered by package provenance
- Repository analysis, goal-loop, schema fuzzing, incremental review, evidence-pack, task-plan, and convergence helpers with focused regression coverage
- Explicit ShareGPT trajectory export from caller-provided recorded events instead of synthetic sample data

### Changed

- Full doctor now requires at least one supported managed-agent CLI instead of requiring Codex and AGY simultaneously; Kaku is optional
- Package security diagnostics scan the installed Riqor package instead of the caller's current working directory
- Repository analysis skips internal worktrees, generated planning data, and symlinked files
- Internal planning, evaluation, and generated graph artifacts are excluded from version control and public release documentation
- Release automation derives npm dist-tags from prerelease identifiers and marks GitHub prerelease tags correctly

### Fixed

- Made swarm locks atomic under concurrent acquisition and bound release to a per-acquisition token
- Prevented task-ledger mutations when another owner holds its lock
- Hardened destructive-command detection against equivalent `rm` flag orders, `--` path separators, and destructive `git reset --hard` target variants
- Validated harness-config targets and removed a release-facing hard-coded harness version
- Exposed supported synthesis commands in CLI usage and removed misleading synthetic trajectory exports

## [0.1.1] - 2026-08-08

### Added

- Repository-scoped run records with explicit goals, workflow paths, and `standard` or `assured` execution profiles
- Ordered JSONL trace events for run start, terminal command results, workspace mutations, verification requirements, verification completion, and run completion
- `riqor run start`, `riqor run status`, and `riqor run complete` commands
- `riqor trace show` and `riqor trace export --format jsonl` commands
- Repository identity binding using a canonical-root digest, Git HEAD, and dirty state without persisting the raw root path
- Per-run locks, stale lock recovery, schema validation, symlink rejection, and atomic mutable state writes
- Documentation hub under `docs/README.md`
- Getting started guide with installation, diagnostics, managed Codex sessions, and rollback
- Complete CLI reference for package, Codex, terminal, plugin, shell, and workflow path commands
- Architecture guide covering install flow, terminal evidence state, Codex hooks, and activator lifecycle
- Security model covering trust boundaries, local state, subprocess handling, and non-goals
- Troubleshooting guide for installation, diagnostics, verification state, activator behavior, and uninstall issues
- Automation guide for SecureAI-Scan, Dynamic Badges, and AutoDemo
- Static visual product preview and deterministic AutoDemo capture scenario
- SecureAI-Scan workflow with high-severity gating, SARIF upload, and report artifacts
- Configurable Gist-backed CI and package version badge workflow
- AutoDemo workflow for video, interactive walkthrough, and marketing screenshot artifacts
- Documentation and workflow pin verification tests

### Changed

- Terminal pre-execution now records only a pending command digest; fresh evidence becomes pending only after a successful mutation exit
- Successful terminal mutations and recognized verification commands update the current repository run when one exists
- Rebuilt the root README around product scope, quick setup, technical behavior, local paths, and security boundaries
- Expanded the npm package README with requirements, run and trace commands, activator limits, and privacy scope
- Expanded contribution guidance with focused checks, security review points, commit conventions, and documentation rules
- Clarified the private vulnerability reporting policy and supported security scope
- Extended action pin verification to discover every YAML workflow automatically

### Fixed

- Bundled package lifecycle scripts required by npm installs, shell integration, and Codex plugin operations
- Prevented package-mode shell setup from overwriting the Riqor executable through a compatibility symlink
- Added ownership checks so install and uninstall preserve unrelated executable paths
- Added cryptographic runtime provenance verification with exact file-set validation
- Separated Codex core health from unrelated doctor warnings and removed hard-coded status version fallbacks
- Made malformed managed shell markers fail closed without rewriting the user's `.zshenv`
- Excluded common operating-system metadata from plugin archives and packaged runtime payloads
- Added safe migration for the managed wrapper produced by the affected `0.1.0` installation path


## [0.1.0] - 2026-08-04

### Added

- Initial public release of the Riqor agent verification runtime
- Support for `npx riqor install` and `brew install imMamdouhaboammar/tap/riqor`
- Command identity with `riqor`, `codex-harness`, and `cxh` shims
- Evidence gating and local Codex plugin integration
- Atomic versioned payload installation and safe rollback through `riqor uninstall`
