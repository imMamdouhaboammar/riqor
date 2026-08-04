# Universal Session Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task

**Goal:** Make Codex Self Improvement load automatically across Codex App, Codex CLI, Kaku, and zsh sessions controlled by ChatGPT

**Architecture:** Keep the native Codex plugin as the authority for Codex sessions, add a local CLI for lifecycle and health, and add silent reversible shell bootstraps for Kaku and non-interactive zsh

**Tech Stack:** Bun, TypeScript, zsh, Bash, Codex Plugins, Kaku managed shell files

## Global Constraints

- Do not replace the original `codex` or `kaku` binaries
- Persist bounded metadata only
- Keep shell startup silent and idempotent
- Back up every external file before modification
- Fail open when local metadata is unavailable

---

### Task 1: Close audit findings

- Add failing regression tests for router matching, telemetry coverage, schemas, action pins, and curated content integrity
- Apply the smallest fixes to the curated skills and router
- Run focused tests and the full suite

### Task 2: Add terminal runtime and CLI

- Add failing tests for command classification, bounded state, doctor output, and executable installation
- Implement `codex-harness` commands for status, doctor, paths, plugin, shell, terminal events, and Codex launch
- Add JSON output and stable exit codes

### Task 3: Add Kaku and zsh integration

- Add failing shell tests for idempotent loading, PATH, Codex wrapper behavior, and evidence state
- Install a minimal `.zshenv` bootstrap and Kaku interactive plugin
- Repair the existing Kaku early-return bug and refresh Kaku managed setup

### Task 4: Release and verify

- Validate and package the plugin
- Install the final plugin in the shared Codex home
- Run fresh Codex and Kaku health checks, shell simulations, plugin smoke, and the complete test suite
- Record exact versions, package digest, installed paths, and remaining boundaries
