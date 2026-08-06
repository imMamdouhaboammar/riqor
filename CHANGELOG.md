# Changelog

All notable changes to Riqor are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

- Rebuilt the root README around product scope, quick setup, technical behavior, local paths, security boundaries, and repository automation
- Expanded the npm package README with requirements, commands, activator limits, and privacy scope
- Expanded contribution guidance with focused checks, security review points, commit conventions, and documentation rules
- Clarified the private vulnerability reporting policy and supported security scope
- Extended action pin verification to discover every YAML workflow automatically

## [0.1.0] - 2026-08-04

### Added

- Initial public release of the Riqor agent verification runtime
- Support for `npx riqor install` and `brew install imMamdouhaboammar/tap/riqor`
- Command identity with `riqor`, `codex-harness`, and `cxh` shims
- Evidence gating and local Codex plugin integration
- Atomic versioned payload installation and safe rollback through `riqor uninstall`
