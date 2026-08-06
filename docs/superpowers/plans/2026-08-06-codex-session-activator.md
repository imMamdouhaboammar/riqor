# Codex Session Activator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bounded periodic checkpoint for Codex sessions started through `riqor codex`.

**Architecture:** Parse activator flags in the Riqor Codex wrapper and export a random managed-session token plus bounded timing values. Use the existing Codex hook lifecycle to trigger one checkpoint at the next safe `Stop` event, with local atomic state and a watchdog that prevents repeated stop loops.

**Tech Stack:** TypeScript, Bun tests, Node child processes, Codex lifecycle hooks, local JSON state.

## Global Constraints

- Only sessions launched by `riqor codex --activator` are eligible
- Default interval is `15m`; default watchdog is `3m`
- Never interrupt an active turn or start a concurrent resume writer
- Preserve Codex approval policy and direct argument arrays
- Do not retain prompts, transcripts, source content, commands, or credentials
- Do not bump versions or publish a release for this feature

---

### Task 1: Wrapper configuration

**Files:**
- Modify: `src/harness-cli.ts`
- Test: `test/codex-activator-cli.test.ts`

**Interfaces:**
- Produces: `parseActivatorDuration(value, limits)` and `parseCodexActivatorArgs(args)`
- Produces managed environment variables for the Codex child

- [ ] Write tests for defaults, duration bounds, invalid values, `--` handling, and argument preservation
- [ ] Run the focused tests and confirm they fail because the parser is absent
- [ ] Implement the parser and Node-compatible Codex child spawn
- [ ] Run focused tests and the harness CLI suite

### Task 2: Activator state

**Files:**
- Create: `plugins/codex-self-improvement/hooks/activator.ts`
- Test: `test/plugin-activator.test.ts`

**Interfaces:**
- Produces: `readActivatorConfig`, `initializeActivator`, `touchActivator`, `observeActivatorStop`, and `clearActivator`

- [ ] Write tests for initialization, not-due behavior, one block, review completion, watchdog expiry, cleanup, isolation, malformed state, and symlink replacement
- [ ] Run the focused tests and confirm they fail because the module is absent
- [ ] Implement bounded secure state, locking, atomic writes, and stale pruning
- [ ] Run focused tests

### Task 3: Hook integration

**Files:**
- Modify: `plugins/codex-self-improvement/hooks/main.ts`
- Modify: `test/plugin-hooks.test.ts`

**Interfaces:**
- Consumes the Task 2 activator state functions
- Preserves the existing evidence gate before starting an activator checkpoint

- [ ] Write hook tests proving unmanaged sessions are unchanged, due managed sessions block once, `stop_hook_active` completes the cycle, watchdog expiry fails open, and evidence checks retain precedence
- [ ] Run focused tests and confirm the new cases fail
- [ ] Integrate activator lifecycle calls and the bounded checkpoint instruction
- [ ] Run plugin hook and state tests

### Task 4: Public documentation and package verification

**Files:**
- Modify: `README.md`
- Modify: `packages/riqor/test/cli.test.ts`

- [ ] Document `riqor codex --activator`, timing flags, managed-session scope, and watchdog semantics
- [ ] Add package routing coverage
- [ ] Run `bun test test/codex-activator-cli.test.ts test/plugin-activator.test.ts test/plugin-hooks.test.ts packages/riqor/test/cli.test.ts`
- [ ] Run `bun run riqor:test`
- [ ] Run `bun test test`
- [ ] Run package build and inspection checks

### Task 5: Review and security gate

- [ ] Inspect the complete branch diff
- [ ] Run a security diff review focused on environment trust, state paths, symlinks, locks, timeout loops, argument forwarding, and subprocess lifecycle
- [ ] Fix validated findings and rerun affected tests
- [ ] Open a pull request and wait for current-head CI evidence before merge
