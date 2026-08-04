# Codex Capability Audit

Snapshot: 2026-08-04, before self-improvement changes  
Objective SHA-256: `7dc3348cd80182cf42d644664cd2ef1513fe06b49316a8e69cfda04fda7285a3`

## Audit rule

This document separates configured, installed, and proven behavior. A listed capability is not treated as effective until a task or a direct check exercises it. No skill, hook, MCP, or plugin was installed or modified during this audit.

## Current control plane

| Surface | Observed state | Confidence / boundary |
|---|---|---|
| Codex runtime | CLI 0.145.0; model `gpt-5.6-sol`; high reasoning | Read from the live CLI and current config |
| Execution authority | approval `never`; sandbox `danger-full-access`; live web search | Effective config; high consequence if routing is wrong |
| JavaScript runtime | Bun 1.3.14 is mandatory | Bun is live; no npm/yarn use is permitted |
| Global instructions | One 14,059-byte `~/.codex/AGENTS.md` | Active through Codex fallback rules; contains duplicate and universal mandates |
| Native features | plugins, apps, hooks, goals, memories, multi-agent, shell snapshot, unified exec, workspace dependencies | Reported enabled by `codex features list`; task quality is not implied |
| Skills | 229 definitions / 191 names across `.agents` and `.codex`; 38 duplicated names; 21 explicitly configured paths | Presence proven, correct discovery and selection unmeasured |
| Plugin cache skills | 330 `SKILL.md` files | Includes available marketplace content, so this is not an active-skill count |
| Plugins | 29 installed; 28 enabled; 1 disabled | Live plugin inventory |
| MCPs | 39 configured rows; 27 enabled; 12 disabled | Configuration proven, end-to-end health not yet proven |
| Hooks | Global GSD hooks plus active plugin hooks for Memorix, Toon, and Codex Fierce | Definitions inspected; only Codex Fierce has a focused local test suite |
| Memory | Codex memories enabled; 250-line registry; 13 rollout summaries; Memorix 1.1.9 installed | Storage exists; recall precision and safe learning are unmeasured |
| Orchestration | OMX 0.20.1, native multi-agent, Agent Kernel | Installed; long-horizon reliability is unmeasured |
| Test tools | Bun test, Playwright, Python, Go, Git, `rg`, `jq` | Executables present; benchmark harness did not yet exist at snapshot time |

## Installed capability groups

- Engineering control: Oh My Codex, Codex Fierce, Ponytail, Impeccable, Agent Kernel instructions.
- Verification and security: Codex Security plugin, local test/verification/review skills, Codacy MCP, code-review-graph MCP.
- Repository and retrieval: Git, filesystem, ripgrep, tree-sitter, code-index, fetch, OpenAI Developer Docs MCPs.
- Product surfaces: GitHub, Google Drive, Vercel, Supabase, Cloudflare, Hostinger, Temporal, Hugging Face.
- Artifact production: documents, PDF, spreadsheets, presentations, sites, browser, Chrome, computer-use, visualization.
- Memory and coordination: native memories, Memorix, memory MCP, sequential thinking, claude-flow, OMX.

These groups describe availability only. They do not establish tool-selection accuracy or task success.

## Existing Codex Fierce baseline

Version `0.0.1+codex.20260804031704` contributes one skill and three hook events:

- `SessionStart`: injects a short evidence-first engineering instruction.
- `PostToolUse`: marks recognized `apply_patch` code mutations and clears the mark after a narrow allowlist of successful structured checks.
- `Stop`: requests one continuation when a recognized mutation lacks a later recognized successful check.

Its six local hook tests passed before this objective was edited. Its documented limits are material: it does not classify tasks, discover capabilities mechanically, control multi-stage execution, verify hosted/MCP mutations, grade test quality, run holdouts, manage learning, or prove rollback.

## Conflicts and unproven areas

1. **No baseline:** no rerunnable suite measured the current system on the eight required task classes.
2. **Fragmented registry:** capability truth is spread across config, two global skill roots, plugin caches, MCP inventory, hooks, and instructions.
3. **Discovery unknown:** 191 skill names and 29 plugins exist, but implicit selection accuracy has not been measured.
4. **Duplicate policy:** 38 skill names occur in both global roots, creating ambiguous precedence and maintenance drift.
5. **Package-manager conflict:** eight configured MCP commands invoke `npx` while the active constitution mandates Bun for all JS/TS execution.
6. **Configuration drift:** `chatgpt-apps@openai-curated` is enabled in config but absent from the live installed-plugin inventory.
7. **Hook coverage gap:** Codex Fierce observes only a narrow mutation/check surface and is intentionally fail-open on local state errors.
8. **Evidence gap:** existing prose rules require verification, but no independent grader derives completion from bounded check identity and exit status.
9. **Memory gap:** storage and hooks exist, but there is no measured recall precision, contamination test, or regression-learning score.
10. **Rollback gap:** Codex exposes plugin remove/add commands, but no change for this objective has yet been made or rolled back.

## Read-only startup probe

A pinned, ephemeral, read-only `codex exec --json` probe completed with the exact requested response, but exposed control-plane failures before task execution:

- Codex exceeded its 2% skills context budget, removed all skill descriptions, and reported 78 additional skills omitted from the model-visible list.
- Twelve load errors were emitted for six duplicated skill names whose `SKILL.md` files lack valid YAML frontmatter in both `.codex/skills` and `.agents/skills`.
- Three Supabase MCP OAuth refreshes and the Polar sandbox OAuth refresh failed.
- Shutdown reported multiple MCP startup failures, including missing environment, missing executable, handshake closure, and 15-second timeouts.
- The trivial response consumed 34,749 input tokens, of which 6,912 were cached, and only 6 output tokens. This is a direct context/cost baseline signal, not an estimate.

The probe proves that capability volume currently harms visibility and startup reliability. It does not yet prove which removals or routing changes improve task outcomes, so no configuration was changed.

## Installation decision

No installation is justified at baseline. The environment already contains overlapping planning, debugging, testing, review, security, memory, browser, and artifact capabilities. The next missing asset is a small evaluation harness, not another capability package. Any later installation must point to a failed scenario that installed capabilities cannot satisfy.

## Baseline contract

The unchanged current environment—including Codex Fierce 0.0.1—is the starting system. Baseline runs must:

- use synthetic repositories only;
- pin the Codex model and execution flags;
- record the current config and plugin inventory digests;
- derive pass/fail from scenario-specific check exit codes;
- keep raw event logs out of user-facing reports;
- report time and token usage when emitted by Codex;
- grade tool selection from bounded expected events;
- make no global capability or configuration changes.

The audit is complete when this snapshot can be regenerated by the harness and its claims match live inventory. Behavioral capability remains unverified until the baseline run.
