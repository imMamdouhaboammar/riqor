# Codex Self-Improvement Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the measured Codex control-plane improvements as a locally installable plugin with bounded hooks, task routing, evidence gates, health checks, and a reversible development install flow

**Architecture:** Keep the benchmark harness as the independent evaluator and build a separate plugin package under `plugins/codex-self-improvement`. Hooks maintain minimal anonymous per-turn state in `PLUGIN_DATA`, route prompts to bounded profiles, and block unsupported completion after observed mutations. Repository scripts validate, package, install, smoke-test, and roll back the plugin through a repo-local marketplace

**Tech Stack:** Bun 1.3+, TypeScript, Codex CLI 0.145.0 plugin and hooks contracts, JSON, shell scripts, Git

## Global Constraints

- Do not claim model-weight changes, AGI, or external-model parity
- Do not retain prompts, source contents, command outputs, credentials, or repository paths in plugin state
- Every blocking hook must fail open on internal errors and surface a bounded warning
- Plugin updates must be cache-busted, validated, installed from a local marketplace, smoke-tested, and reversible
- Correctness and privacy take priority over token or time reduction

---

### Task 1: Preserve the Harness Security Boundary

**Files:**
- Modify: `src/checks.ts`
- Modify: `test/security.test.ts`

- [x] Add a failing test proving Codex on macOS does not isolate sibling writes for repositories under OS temporary storage
- [x] Reject OS-temporary repositories instead of claiming isolation that the platform does not provide
- [x] Run `bun test test/security.test.ts`

### Task 2: Create the Plugin Contract

**Files:**
- Create: `plugins/codex-self-improvement/.codex-plugin/plugin.json`
- Create: `plugins/codex-self-improvement/hooks/hooks.json`
- Create: `plugins/codex-self-improvement/package.json`
- Create: `.agents/plugins/marketplace.json`

- [ ] Write validator tests for the required manifest, hooks discovery, strict semver, and marketplace source
- [ ] Create the smallest valid plugin and repo-local marketplace entry
- [ ] Validate with the installed Codex `plugin-creator` validator

### Task 3: Add Bounded Task Routing

**Files:**
- Create: `plugins/codex-self-improvement/hooks/router.ts`
- Create: `plugins/codex-self-improvement/hooks/router.test.ts`
- Create: `plugins/codex-self-improvement/skills/self-improvement-loop/SKILL.md`
- Create: `plugins/codex-self-improvement/skills/evidence-engineering/SKILL.md`

- [ ] Test deterministic classification for debugging, review, database, security, UI, research, and engineering tasks
- [ ] Return concise additional context on `UserPromptSubmit` without storing the prompt
- [ ] Keep routing profiles bounded and map them to installed skill names only as suggestions

### Task 4: Add Evidence and Continuity Hooks

**Files:**
- Create: `plugins/codex-self-improvement/hooks/main.ts`
- Create: `plugins/codex-self-improvement/hooks/main.test.ts`
- Create: `plugins/codex-self-improvement/hooks/state.ts`
- Create: `plugins/codex-self-improvement/hooks/state.test.ts`

- [ ] Record only anonymous event flags and timestamps after recognized edits and checks
- [ ] Invalidate earlier verification after a later mutation
- [ ] Block `Stop` once when a mutation lacks a later successful check
- [ ] Add compact session and subagent context
- [ ] Bound state files, permissions, retention, and symlink handling

### Task 5: Add Plugin Health, Packaging, and Rollback

**Files:**
- Create: `scripts/plugin-health.ts`
- Create: `scripts/package-plugin.ts`
- Create: `scripts/install-plugin.sh`
- Create: `scripts/uninstall-plugin.sh`
- Create: `test/plugin-package.test.ts`
- Modify: `package.json`

- [ ] Validate source package and marketplace metadata
- [ ] Build a deterministic ZIP without secrets, transient runs, or development fixtures
- [ ] Install via repo-local marketplace using a Codex cachebuster
- [ ] Smoke-test plugin discovery and hook execution in an isolated `CODEX_HOME`
- [ ] Prove uninstall and previous-plugin restoration instructions

### Task 6: Independent Review and Release Evidence

**Files:**
- Create: `PLUGIN_EVALUATION.md`
- Modify: `README.md`
- Modify: `EVOLUTION_LOG.md`

- [ ] Run the full harness and plugin test suites
- [ ] Run plugin validator and health checks
- [ ] Run CodeRabbit on the Git diff and resolve accepted issues
- [ ] Record exact commands, exits, plugin version, Codex version, limitations, and rollback
- [ ] Commit the verified package and create the ZIP artifact
