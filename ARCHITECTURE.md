# Measured Self-Improvement Architecture

Version: 0.6.0
Plugin: `codex-self-improvement`
Installed plugin version: `0.2.0+codex.20260809081834`

## Boundary

The project improves Codex through a measured control plane around the model

It may change task routing, visible skills, lifecycle hooks, temporary execution context, evaluation, and rollback behavior

It does not change model weights and cannot convert a probabilistic model into a deterministic model

## Components

| Component | Implementation | Evidence boundary |
|---|---|---|
| Capability audit | `CAPABILITIES.md`, live CLI inventory, plugin inventory, skill lock | Availability is separated from proven use |
| Task classifier | Deterministic rules in `hooks/router.ts` | No extra model call and no prompt retention |
| Harness path registry | Frozen definitions in `hooks/paths.ts` | Every path declares objective, evidence, guardrails, and approvals |
| Curated external skills | Nine project-local copies under `.agents/skills` | Every directory must exist in `skills-lock.json` |
| Candidate capsule | `src/capsule.ts` | Owner-only temporary home with selected skill links only |
| Lifecycle routing | `SessionStart`, `UserPromptSubmit`, `SubagentStart` | Additional context is bounded and contains no prompt copy |
| Mutation evidence gate | `PostToolUse`, `Stop` | One reminder after a recognized mutation without later accepted check |
| Anonymous state | Hashed turn files in `PLUGIN_DATA` | Event kind and timestamps only |
| State concurrency | Per-turn exclusive lock with bounded wait | A competing lock is never deleted during acquisition |
| Independent graders | Scenario and holdout graders | Agent prose cannot self-award a pass |
| Packaging | Deterministic Python ZIP builder | Fixed timestamps, sorted entries, no tests or credential-shaped files |
| Terminal runtime | `src/harness-cli.ts`, `src/terminal-runtime.ts` | Hashes, route, command class, exit code, and evidence state only |
| Kaku and zsh bootstrap | Managed `.zshenv` block and Kaku plugin | Silent, idempotent, reversible, original binaries preserved |
| Install and rollback | Repo-local marketplace and scripts | Cachebuster, isolated smoke, active inventory check, timestamped shell backups, explicit uninstall |

## Execution flow

1. Classify the prompt into database, debugging, review, security, UI, research, privacy, performance, evolution, or engineering
2. Select one primary harness path
3. Add only a bounded route summary to the active Codex turn
4. For candidate benchmark runs, create a temporary `CODEX_HOME` with mode `0700`
5. Link the existing owner-only auth file without reading or copying its contents
6. Link native task skills plus reviewed project-local skills from the selected path
7. Write an evidence-first `AGENTS.md` containing path objective, evidence, guardrails, and explicit approvals
8. Run the same task and independent checks as control
9. Record bounded result evidence including the selected path ID
10. Delete the candidate capsule and synthetic repository in `finally`

## Curated path model

### Architecture conformance

Default mode is review-only

Baseline creation, strict enforcement, broader contracts, and exceptions require explicit approval

### Controlled evolution

A repeated failure or correction is required before drafting a playbook

The default output is a proposal with holdouts and rollback

Durable memory publication, lifecycle hook installation, daemon start, and environment mutation are never automatic

### Independent review

Standards and specification reviewers use isolated contexts

Reviewer findings are checked against the real diff and fresh commands

Repository content is not sent to an external model without explicit approval

### Privacy and security

Privacy evidence uses metadata and synthetic records

Security evidence records secret locations and fingerprints only

Live secret reads, credential rotation, revocation, and external scans require explicit approval

### Performance and browser evidence

Performance uses the same local or synthetic workload for control and candidate

Browser evidence uses isolated test data and condition-based waits

Production load, production accounts, and external artifact upload require explicit approval

## Plugin state model

Each turn key is a SHA-256 digest of `session_id` and `turn_id`

State contains only

- Version
- Mutation kind
- Mutation time
- Optional verification time
- Whether the one-time evidence reminder was already used

The plugin does not store prompts, file paths, command text, output, source content, credentials, personal data, or repository identity

Read-modify-write operations acquire a per-turn lock with exclusive `wx` creation

The lock wait is bounded and internal failure is fail-open with a visible warning

The plugin never deletes an existing competing lock during acquisition

## Evaluation model

Baseline covers eight task classes

Holdouts cover atomic behavior, database schema, security completion claims, and prompt-injection resistance

Control and candidate share model, task, fixture, checks, timeout, and concurrency

Candidate evidence now records `harnessPath` for each holdout

Acceptance requires

- Every candidate holdout passes
- Every derived check passes
- No test-quality regression
- No tool-selection regression
- Candidate-only rollback passes
- Time falls
- Measured token usage falls
- Structured errors do not increase

Missing token usage is never converted to zero

A quota-blocked model turn is reported as unavailable rather than successful

## Rollback

Plugin rollback

```bash
bash scripts/uninstall-plugin.sh --remove-marketplace
```

Prior prototype restoration

```bash
codex plugin add codex-fierce@local-marketplace
```

Source rollback

```bash
git revert <release-commit>
```

Candidate capsule rollback is automatic through `finally` cleanup and before-versus-after global digest checks

## Surface integration

Codex App and Codex CLI use the native plugin from the shared Codex home

The Codex binary bundled inside ChatGPT reads the same installed plugin inventory

Kaku loads the terminal runtime through its managed shell loader and records actual shell exit codes

Remote Desktop and other zsh processes inherit the harness root and executable path from `.zshenv`

ChatGPT itself does not load local Codex plugin code inside the hosted conversation runtime
