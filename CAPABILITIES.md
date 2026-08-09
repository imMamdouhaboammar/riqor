# Codex Capability Audit

Snapshot updated: 2026-08-04

## Proven in this repository

| Capability | Evidence |
|---|---|
| Codex CLI plugin ingestion | Source validated and installed through a repo-local marketplace |
| Lifecycle hook execution | Real installed `SessionStart` wrote the bounded runtime marker in isolated `PLUGIN_DATA` |
| Prompt routing | Ten deterministic profiles and eight frozen harness paths have passing tests |
| Completion evidence gate | Recognized mutation, accepted check, later invalidation, one-time block, and fail-open paths have passing tests |
| Anonymous state | Hashed file names, bounded schema, owner-only permissions, symlink defense, pruning, and lock contention have passing tests |
| Candidate capsule | Owner-only temporary home, safe auth link, selected skills only, path instructions, and cleanup have passing tests |
| Independent verification | Broken fixtures are rejected and reference fixtures are accepted across baseline and holdout graders |
| Deterministic packaging | Repeated source build produces the same ZIP digest and excludes tests and credential-shaped files |
| Plugin rollback | Uninstall script and prior `codex-fierce` reinstall command are available |
| Universal CLI | `codex-harness` and `cxh` resolve in fresh zsh and Remote Desktop sessions |
| Kaku integration | `kaku doctor` reports 8 ok, 0 warnings, and 0 failures after managed PATH repair |
| ChatGPT local Codex | The bundled Codex binary lists the same installed and enabled plugin version |

## Active plugin

Name: `codex-self-improvement`
Marketplace: `codex-self-improvement-dev`
Installed version: `0.2.0+codex.20260804101214`

Plugin skills

- `evidence-engineering`
- `harness-paths`
- `self-improvement-loop`
- `universal-session-runtime`

Hook events

- `SessionStart`
- `UserPromptSubmit`
- `SubagentStart`
- `PostToolUse`
- `Stop`
- `SessionEnd`

## Curated project skills

Nine project-local skills are locked under `.agents/skills`

- `architecture-guardian`
- `agent-kernel-evolve`
- `code-review`
- `agency-multi-agent-systems-architect`
- `agency-privacy-engineer`
- `agency-application-security-engineer`
- `agency-secrets-credential-hygiene-engineer`
- `agency-performance-benchmarker`
- `agency-test-automation-engineer`

The raw `agent-kernel` root skill was removed after installation because it copied 687 files and 4.1 MB of runtime, tests, installers, and documentation into the project

The already-installed `agent-kernel 1.19.0` CLI remains available but the harness permits only reviewed commands through bounded path instructions

## Skills pack source

Requested pack

`https://skills.sh/p/Hdo5gpURfnt2T9GG`

Discovery returned 59 skills

The well-known installation endpoint later returned HTTP 429 after its hourly request limit

The selected skills were therefore installed from their primary GitHub repositories with the same `npx skills add` CLI and recorded in `skills-lock.json`

Source revisions and curation decisions are recorded in `config/skill-curation.json`

## Unproven or unavailable

- Fresh model-backed smoke response is unavailable while the account usage limit is active
- The hosted ChatGPT conversation runtime cannot execute a local Codex plugin directly
- A new full control-versus-candidate benchmark with the curated paths has not been produced under that quota condition
- The current evidence does not establish open-world coding superiority
- The current evidence does not establish external-model parity
- The plugin cannot force arbitrary hosted tools to expose structured success data
- Shell command recognition is intentionally bounded and may miss an unusual valid check
- Automatic learning remains proposal-only and is not allowed to publish durable memory

## Capability rule

Installed is not equivalent to effective

A capability becomes proven only when a direct check or scenario exercises it and independent evidence confirms the outcome
