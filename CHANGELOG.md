# Changelog

All notable changes to Riqor are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
