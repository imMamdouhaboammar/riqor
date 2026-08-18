# Riqor Autonomous Engineering Baseline

Date: 2026-08-17
Starting commit: `f3ce876f6278b762ac8b759996748ff5a13d9feb`

This baseline records repository reality observed before the first daily autonomous engineering initiative. Executable behavior, tests, CI, and persisted contracts take precedence over aspirational documentation when they disagree.

## Product Boundary

Riqor is a local evidence-control runtime around AI-assisted engineering. Its strongest current product responsibility is to make completion claims depend on observable verification after meaningful mutation, while preserving bounded local state and host integrations. It is not a general coding agent, IDE, project manager, or test framework.

## CLI Architecture

The packaged CLI is exposed as `riqor` with compatibility aliases `codex-harness` and `cxh`. Assurance commands route `run start`, `run status`, `run complete`, `trace show`, and `trace export` into `src/assurance/cli.ts`; other harness behavior is delegated through the packaged runtime and harness CLI.

Key boundary: the CLI resolves the repository identity before assurance operations and passes that identity into the run store.

## Session Lifecycle

Persisted assurance runs currently use:

```text
active
verification-pending
completed
failed
abandoned
```

Observed core path:

```text
run start
→ active
→ successful mutation
→ verification-pending
→ successful recognized verification
→ active
→ run complete
→ completed
```

The state model is intentionally smaller than the conceptual lifecycle vocabulary. That is appropriate while each persisted state has executable meaning.

## Mutation Pipeline

There are two related mutation mechanisms:

1. Terminal runtime command classification (`src/terminal-runtime.ts`) classifies shell commands as mutation, verification, agent, or other.
2. Codex plugin hooks (`plugins/riqor/hooks/main.ts`) observe explicit mutation tools and shell mutations for per-turn evidence gating.

For an active assurance run, a successful terminal mutation emits a `command_completed` event plus `workspace_mutated` and `verification_required`, moving the run to `verification-pending`.

Current limitation: mutation meaning is largely regex/tool based; generated, dependency, config, and external filesystem changes are not yet represented by a durable mutation taxonomy.

## Verification Pipeline

Recognized terminal verification commands only count when the process exit code is zero. For an active run already in `verification-pending`, a successful recognized verification emits `verification_completed` and records bounded repository metadata when repository inspection succeeds.

The Codex plugin has a separate per-turn verification recognizer with scoped code/docs checks and structured exit-code requirements.

Current limitation: recognized command shape is a proxy for relevance. Riqor does not yet prove that a check covers the files changed by the latest mutation.

## Freshness Semantics

At the starting commit, freshness was represented mainly by the run status:

```text
mutation → verification-pending
successful verification → active
```

The trace already carried repository `HEAD` and dirty-state metadata on successful verification when inspection succeeded, but `run complete` did not consume that provenance. That gap became the first daily initiative.

After today's initiative, a run that has observed a mutation must have a later successful `verification_completed` event with usable repository provenance matching the repository identity presented at completion. Runs with no observed mutation preserve the existing ability to complete without an unnecessary verification.

Known limitation: `HEAD` plus a boolean dirty flag cannot distinguish two different dirty working trees with the same `HEAD`.

## Completion Gate

At the baseline, `completeRun` rejected `verification-pending` but otherwise trusted `active`. A direct/manual transition could therefore substitute state for evidence, and repository state could change after verification without being checked at completion.

Today's change tightens the gate to use the ordered trace as the source of evidence after mutation. This is deliberately a policy check in the run store rather than a CLI-only convention.

## Activator Behavior

The activator is opt-in for managed sessions. It operates at safe lifecycle boundaries, tracks bounded timing state, lets the evidence gate take precedence, and avoids a background daemon or second terminal writer. The watchdog can fail open after a bounded checkpoint cycle; this is separate from the persisted assurance-run completion gate.

## Run Trace Architecture

Run traces are append-only JSONL with monotonically increasing sequence numbers. Mutable `run.json` is atomically replaced. The run store can reconcile a trace event committed before its corresponding mutable run-record update and fails closed when mutable state is ahead of the trace.

Trace data is intentionally content-bounded: event type, status, timestamp, digests, bounded metadata, and evidence references rather than source contents, raw commands, prompts, secrets, or environment values.

## Persistence

Default assurance state is repository-scoped below the Riqor state root:

```text
projects/<repository-root-digest>/
  active.json
  runs/<run-id>/
    run.json
    events.jsonl
    .lock
```

State files use owner-only permissions, symlink checks, per-run locks, atomic JSON replacement, bounded schemas, and stale-lock recovery.

## Repository Identity

The current identity combines:

- digest of canonical repository root path
- Git `HEAD` when available
- boolean Git dirty state
- canonical root path in memory only

The raw path is not persisted in run records or traces. Worktree and non-Git behavior deserve further adversarial testing before stronger identity claims are made.

## Host Integrations

Current integration surfaces include:

- generic terminal shell integration
- Codex plugin lifecycle hooks
- managed Codex activator
- packaged CLI/harness paths
- local plugin/skills packaging

The assurance run store and terminal evidence path remain local-first and do not require a network service.

## Plugin Packaging

The Codex plugin ships a bounded manifest, lifecycle hooks, curated workflow paths, Skills, agent-skill mapping, and visual assets. Repository tests validate manifest shape, package contents, health checks, and public-surface constraints.

## Release Process

CI builds the package, runs unit/integration tests, validates plugin and Skills health, inspects the packed npm artifact, runs packaged tests, and verifies action pins. Release automation is tag-driven, but npm publication is intentionally disabled in GitHub Actions and remains a manual local-terminal action. The workflow can prepare and compare release artifacts without granting this daily agency authority to publish them.

## Test Architecture

The repository uses Bun tests across assurance storage, crash recovery, terminal trace integration, plugin lifecycle hooks, package/install flows, security boundaries, release artifacts, workflow pinning, and broader harness behavior. CI also exercises the packed runtime.

The first initiative added a focused adversarial suite for completion freshness so the bug was demonstrated before implementation.

## Security Boundaries

Relevant controls observed:

- structured process APIs rather than shell interpolation for Git inspection
- bounded command/source metadata instead of raw command persistence in assurance traces
- owner-only local state permissions
- symlink rejection for assurance state files
- repository digest isolation
- bounded trace fields and schema validation
- pinned GitHub Action revisions
- no autonomous npm publication

Remaining security-relevant areas include stale-lock ownership, hostile repository names/paths across all adapters, and false-positive verification recognition.

## Performance Risks

Current assurance hot paths execute synchronous Git inspection with bounded timeout/buffer and append small local records. No evidence from this run justified speculative optimization.

Risks worth measuring later:

- repeated Git status calls in large repositories
- very long JSONL run traces
- lock contention from concurrent agents
- repeated filesystem scans in auxiliary capabilities

## Cross-Platform Assumptions

The code uses Node/Bun filesystem and process APIs and avoids shell mode for repository inspection. CI primarily proves Ubuntu behavior. Filesystem permissions, `O_NOFOLLOW`, signals, shell integration, path semantics, and Git behavior still require deliberate Windows/WSL/macOS coverage before broad compatibility claims.

## Candidate Improvements

Priority score formula:

```text
(Core Mission Fit × 3)
+ (Reliability Impact × 2)
+ User Value
+ Evidence Strength
+ Testability
+ Learning Value
+ Integration Value
+ Implementation Confidence
- Maintenance Cost
- Regression Risk
```

Each component is scored 1–10. Higher total is better.

| Rank | Candidate | Mission | Reliability | User | Evidence | Testability | Learning | Integration | Confidence | Maint. cost | Regression risk | Priority |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Bind completion to fresh trace-backed repository evidence | 10 | 10 | 9 | 10 | 10 | 8 | 8 | 9 | 3 | 4 | **97** |
| 2 | Add a working-tree fingerprint for dirty→dirty freshness | 10 | 10 | 9 | 9 | 8 | 9 | 8 | 7 | 6 | 6 | **88** |
| 3 | Make run reconciliation status-aware for failed verification events | 9 | 8 | 7 | 8 | 9 | 7 | 6 | 9 | 2 | 3 | **84** |
| 4 | Re-inspect repository state at the completion boundary to reduce TOCTOU | 10 | 9 | 8 | 8 | 8 | 8 | 7 | 7 | 5 | 5 | **84** |
| 5 | Harden verification recognition against false-positive script names | 9 | 9 | 8 | 8 | 8 | 8 | 8 | 7 | 5 | 6 | **81** |
| 6 | Add explainable completion-block diagnostics using last mutation/check | 8 | 7 | 9 | 8 | 9 | 7 | 7 | 9 | 3 | 3 | **81** |
| 7 | Harden mutation classification for config/dependency/generated changes | 9 | 8 | 8 | 7 | 8 | 8 | 8 | 7 | 5 | 5 | **79** |
| 8 | Audit and test worktree-aware evidence isolation | 9 | 9 | 7 | 7 | 7 | 9 | 7 | 6 | 6 | 6 | **76** |
| 9 | Add meaningful freshness semantics for non-Git workspaces | 9 | 9 | 7 | 8 | 6 | 8 | 6 | 6 | 7 | 6 | **73** |
| 10 | Strengthen run-store stale-lock ownership before recovery | 7 | 9 | 6 | 7 | 8 | 8 | 5 | 7 | 5 | 5 | **70** |
| 11 | Harden active-run pointer concurrency races | 8 | 9 | 6 | 7 | 7 | 8 | 5 | 6 | 5 | 6 | **70** |

## Why Candidate 1 Was Selected

The repository already persisted exactly the evidence needed to improve the completion decision, yet the decision did not consume it. The bug was high mission-fit, reproducible with deterministic local tests, small enough for one bounded change, and did not require a persisted-schema migration or new dependency.

The change directly answers Riqor's core question: after a meaningful mutation, can an agent claim completion without current evidence? At the baseline, several state-manipulation and stale-repository cases could. The selected initiative closes those demonstrated paths while leaving broader fingerprinting and change-aware verification for later runs.
