# Changelog

All notable changes to Riqor are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.6] - 2026-08-09

### Added

- Add `chatgpt-codex-plugin-autopilot`, a repo-agnostic operational Skill for end-to-end ChatGPT/Codex plugin inspection, repair, validation, packaging, submission diagnosis, publication, and post-publish verification
- Add dependency-free Python preflight and deterministic ZIP tooling with final-directory metadata, archive, branding, Skill, URL, and public-exclusion checks

### Changed

- Expand the public plugin from 111 to 112 Skills while keeping 100 public-safe generated specialist pairs
- Tighten Riqor listing metadata to the current public-directory short-description limit
- Increase integration-test timeout budgets for registry/network preflight and tarball inspection so release verification remains stable under concurrent full-suite load

### Security

- Encode explicit public-distribution exclusion checks so internal-only or moderation-rejected capabilities cannot silently return through generated Skills, agent copies, indexes, or archives

## [0.2.5] - 2026-08-09

### Changed

- Exclude the rejected penetration-testing specialist from the public ChatGPT/Codex plugin, its distributed native-agent profile, generated mapping, routing index, and release archive while preserving the canonical repository agent source
- Add a generator-level public-plugin exclusion guard so the removed specialist cannot return during regeneration
- Update public plugin counts to 100 generated specialist pairs plus 11 workflow Skills, for 111 bundled Skills total

## [0.2.4] - 2026-08-09

### Added

- Expose all 101 native specialist roles as portable paired Skills for ChatGPT and Codex, while preserving the native Codex agent catalog
- Require every generated native agent to load its exact paired Skill before executing a task
- Add deterministic agent-to-Skill generation, mapping hashes, drift checks, and a generated specialist routing index
- Add GitHub-hosted Privacy Policy, Terms of Service, and Customer Support URLs to the plugin manifest
- Add a local-only adoption ledger with report, bucketed receipt export, and reset commands

### Changed

- Reposition the Plugin Directory package as a 101-specialist capability pack with 112 total Skills including the existing Riqor workflow Skills
- Clarify the hosted ChatGPT boundary: bundled Skills can run in ChatGPT while local CLI and lifecycle runtime features require a compatible local execution surface

### Security

- Keep adoption data content-free and local-only, with no network telemetry primitives or remote aggregation in this release
- Limit the credential-shaped filename exception to the known generated Security Secrets Credential Engineer artifacts

## [0.2.3] - 2026-08-09

### Fixed

- Use the square `assets/mark.svg` for the plugin `logo` and `composerIcon` manifest fields
- Validate manifest-referenced SVG assets are square before packaging
- Prevent uploader rejection caused by the 640×160 horizontal wordmark

## [0.2.2] - 2026-08-09

### Fixed

- Put `.codex-plugin/plugin.json` directly at the Plugin ZIP root for uploader compatibility
- Kept all 101 native Codex agent role configs in the root-layout plugin archive
- Added a regression test that rejects the previously wrapped `riqor/` archive layout

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
