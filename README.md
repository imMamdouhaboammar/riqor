# Codex Self-Improvement Harness

A measured control plane for improving how Codex classifies engineering work, selects bounded capabilities, preserves evidence, and rejects unsupported completion claims

It does not modify model weights and does not claim AGI, determinism, or parity with Claude Fable or Mythos

## Current deliverables

- Reproducible baseline harness with eight task classes
- Four unseen holdout repositories
- Task-scoped candidate capsules with owner-only temporary `CODEX_HOME`
- Installable Codex plugin with automatic lifecycle hooks and completion evidence gate
- Eight curated harness paths
- Nine reviewed project-local skills with `skills-lock.json`
- Deterministic ZIP packaging and local marketplace install flow
- `codex-harness` and `cxh` commands available from every zsh session
- Automatic Kaku mutation and verification tracking with zsh completion
- Shared Codex home integration verified for Codex CLI and the Codex binary bundled with ChatGPT
- Explicit uninstall and prior-plugin rollback commands

## Run the harness

```bash
bun run test
bun run baseline
bun run compare
```

`baseline` runs the eight versioned synthetic scenarios in the control environment

`compare` runs the four unseen holdouts through control and candidate modes while keeping model, task, checks, timeout, and concurrency fixed

A candidate is accepted only when all holdouts pass, quality does not regress, time and measured tokens fall, errors do not increase, and candidate-only state rollback is proven

## Run and install the plugin

```bash
bun run plugin:test
bun run plugin:health
bun run plugin:package
bun run plugin:smoke
bun run plugin:install
```

The install script performs the following sequence

1. Official Codex plugin validation
2. Plugin, path, skill-curation, capsule, runner, and package tests
3. Source health inspection
4. Codex cachebuster update
5. Isolated marketplace install and real `SessionStart` hook execution
6. Local marketplace install in the active Codex home
7. Deterministic ZIP creation
8. Installed-plugin inventory verification


## Automatic session integration

Install or refresh every local surface

```bash
bun run universal:install
```

Common commands

```bash
codex-harness status --json
codex-harness doctor --json
codex-harness paths list --json
cxh terminal status --json
codex-harness codex
```

Codex App and Codex CLI load the native plugin from the shared `~/.codex` home

Kaku loads bounded preexec and precmd hooks, tracks only commands that may mutate files, run checks, or launch an agent, and skips ordinary commands such as `pwd` and `ls`

ChatGPT-controlled Kaku and zsh commands inherit the same environment and terminal evidence state

The hosted ChatGPT conversation does not execute local Codex plugins inside its own runtime

The integration never replaces the original `codex` or `kaku` executable

## Harness paths

| Path | Primary job | Curated skills |
|---|---|---|
| `architecture-conformance` | Reuse discovery and architecture checks | `architecture-guardian` |
| `controlled-evolution` | Proposal-only learning from repeated evidence | `agent-kernel-evolve` |
| `evidence-loop` | Reproduction, bounded change, fresh verification | Native and installed verification skills |
| `independent-review` | Standards and specification review in isolated contexts | `code-review`, `agency-multi-agent-systems-architect` |
| `privacy-minimization` | Purpose, retention, deletion, and data minimization | `agency-privacy-engineer` |
| `secure-change` | Trust boundaries, authorization, and credential hygiene | `agency-application-security-engineer`, `agency-secrets-credential-hygiene-engineer` |
| `performance-evidence` | Fixed local workload and comparable measurements | `agency-performance-benchmarker` |
| `e2e-evidence` | Deterministic browser-flow evidence | `agency-test-automation-engineer` |

No third-party skill receives automatic authority

Memory publication, hook installation, daemon start, environment mutation, external delegation, live secret reads, credential rotation, production load, and external artifact upload require explicit approval

## Evidence files

- `BASELINE.md` and `baseline-results.json`
- `FINAL_EVALUATION.md` and `final-results.json`
- `ARCHITECTURE.md`
- `CAPABILITIES.md`
- `SKILL_CURATION.md`
- `PLUGIN_EVALUATION.md`
- `EVOLUTION_LOG.md`
- `config/skill-curation.json`
- `skills-lock.json`

Public evidence retains scenario identifiers, path identifiers, derived check results, timing, structured usage when available, bounded error counts, and environment digests

It does not retain prompts, source contents, commands, stderr, tool output, credentials, personal data, or repository paths

## Disable and rollback

Remove the current plugin while keeping its marketplace

```bash
bun run plugin:uninstall
```

Remove the plugin and its development marketplace

```bash
bash scripts/uninstall-plugin.sh --remove-marketplace
```

Restore the previous prototype if needed

```bash
codex plugin add codex-fierce@local-marketplace
```

Candidate capsules are deleted in `finally` and do not modify global Codex config, plugins, memories, hooks, or MCP entries

## Current limitation

The plugin and lifecycle hooks are validated and installed, but a fresh model-backed smoke response and a new full control-versus-candidate benchmark cannot run while the connected Codex account is blocked by its usage limit

The smoke test therefore reports hook execution separately from the model turn and does not convert a quota failure into a plugin success claim
