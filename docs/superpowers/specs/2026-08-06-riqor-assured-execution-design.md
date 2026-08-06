# Riqor Assured Execution Design

Status: Approved

Date: 2026-08-06

## Goal

Evolve Riqor into a local assurance supervisor for AI coding sessions. Riqor will own run state, evidence freshness, completion gates, checkpoints, trace lineage, and ecosystem coordination without becoming a model provider, memory backend, multi-agent router, or Playbook executor.

## Product Boundary

Riqor owns:

- Session and run identity
- Goal and selected workflow path
- Execution profile
- Evidence freshness
- Completion eligibility
- Checkpoints and resume validation
- Parent and child run lineage
- Bounded trace events
- Adapter discovery and health

Riqor does not own:

- Model provider abstraction
- Chat completion APIs
- General tool execution
- Durable knowledge and user memory
- Agent selection and delegation policy
- Playbook execution
- Security scanner implementation

The ecosystem ownership contract is:

| Project | Authority |
| --- | --- |
| Riqor | Run assurance, trace, evidence, checkpoints, completion |
| agent-kernel | Reviewed memory, project rules, failure lessons, durable proposals |
| delegate-team | Agent discovery, routing, delegation, executor coordination |
| dokion | User-authored Playbooks, declared permissions, approvals, repairs, verification |
| Codex Security | Security discovery, validation, and findings |

## Core Decision

Assurance strictness is an execution profile, not a new workflow path.

```ts
type ExecutionProfileId = "standard" | "assured";

type RunSelection = {
  pathId: HarnessPathId;
  profileId: ExecutionProfileId;
};
```

Existing paths such as `secure-change`, `evidence-loop`, and `e2e-evidence` continue to describe the work type. The `assured` profile adds plan, evidence, checkpoint, and completion discipline across any path.

## Design Sources

The design adopts selected ideas from three external projects without copying their broader product boundaries.

### LightAgent

Adopt:

- Structured trace events
- Run, parent run, and run group identifiers
- Checkpointed records
- Resume and rerun validation
- Durable approval references
- Deterministic evaluation against trace events
- Export adapters separated from core storage

Reject:

- Provider abstraction
- Chat APIs
- General tool registry
- Agent runtime
- Swarm implementation
- Memory backend
- DAG execution engine

### fable5-mode

Adopt:

- Plan gate for substantial work
- Small task cards with machine-checkable acceptance
- Evidence required before close
- Open, passed, failed, and deferred card state
- Failure attribution after repeated failed checks
- State-adaptive context injection
- External progress state instead of transcript dependence
- Watchdog and resumable checkpoints
- Explicit opt-in

Reject:

- Claude-specific model naming as a core Riqor contract
- Project-global enforcement without a Riqor run
- Markdown as the only source of runtime truth

### Codely Agent Harness

Adopt:

- Vertical implementation phases
- Explicit public contracts per phase
- One reviewable phase at a time
- Each phase ending in real verification
- Optional GitHub parent issue and sub-issue mapping
- Converting repeated user corrections into reviewed documentation proposals

Reject:

- Agent-specific symlink ownership inside Riqor
- Automatic repository issue mutation without explicit approval
- A generic skills marketplace inside Riqor

## Architecture

The complete target has five bounded increments.

1. Run Record and Trace Foundation
2. Assured Profile and Ledger
3. Ecosystem Discovery Adapters
4. Checkpoints, Delegation Lineage, and Approval References
5. Deterministic Evaluation and Optional GitHub Plan Bridge

Each increment must produce independently usable software and preserve all existing CLI, plugin, package, and shell behavior.

## Phase 1: Run Record and Trace Foundation

Phase 1 is the first implementation slice and the only implementation covered by the initial plan.

### User-visible commands

```bash
riqor run start --goal "Add resumable trace records"
riqor run status
riqor run complete
riqor trace show <run-id>
riqor trace export <run-id> --format jsonl
```

All commands support `--json` where a structured result is useful.

### Run record

```ts
type RiqorRunStatus =
  | "active"
  | "verification-pending"
  | "completed"
  | "failed"
  | "abandoned";

type RiqorRun = {
  schemaVersion: 1;
  runId: string;
  runGroupId: string;
  parentRunId?: string;
  goal: string;
  pathId: HarnessPathId;
  profileId: "standard" | "assured";
  status: RiqorRunStatus;
  repository: {
    rootDigest: string;
    headSha: string | null;
    dirty: boolean;
  };
  nextSequence: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};
```

The goal is an explicit user-supplied field, not a captured prompt. It is normalized, bounded to 2,000 UTF-8 characters, and rejected when empty after normalization.

### Trace event

```ts
type RiqorTraceEventType =
  | "run_started"
  | "command_completed"
  | "workspace_mutated"
  | "verification_required"
  | "verification_completed"
  | "run_completed";

type RiqorTraceEvent = {
  schemaVersion: 1;
  eventId: string;
  sequence: number;
  runId: string;
  runGroupId: string;
  source: "riqor" | "terminal";
  type: RiqorTraceEventType;
  status: "pending" | "success" | "failure";
  timestamp: string;
  subject?: string;
  digest?: string;
  evidenceRefs?: string[];
  metadata?: Record<string, string | number | boolean | null>;
};
```

Trace events never contain raw shell commands, prompt bodies, source file contents, command output, environment values, credentials, cookies, or tokens.

### Storage layout

```text
${RIQOR_STATE_HOME:-${XDG_STATE_HOME:-~/.local/state}/riqor}/
  projects/<repository-root-digest>/
    active.json
    runs/<run-id>/
      run.json
      events.jsonl
      .lock
```

File and directory permissions:

- State directories: `0700`
- State files: `0600`
- Atomic JSON replacement through temporary file plus rename
- Append-only JSONL trace
- Exclusive per-run lock for sequence allocation and state transition
- Stale lock recovery after a bounded interval
- Symlinks rejected for mutable state files

### Repository identity

Riqor resolves the canonical repository root with Git when available. It records only:

- SHA-256 digest of the canonical root path
- Current Git HEAD when available
- Dirty boolean

The raw canonical path is used only in memory to locate the project state directory. It is not persisted in the run record or event stream.

### Active run selection

A project has at most one active run pointer. Starting a second active run fails with a clear message unless the prior run is completed, failed, or abandoned.

Commands and terminal hooks resolve the active run from the current working directory. A run ID supplied explicitly must belong to the current repository digest.

### Terminal integration

The existing shell runtime remains the command classifier and evidence source.

On a processed `postexec` transition:

- Every command appends `command_completed`
- A successful mutation sets the run status to `verification-pending`
- A successful mutation appends `workspace_mutated` and `verification_required`
- A successful verification clears `verification-pending` and appends `verification_completed`
- Failed commands never clear pending evidence
- Failed mutations do not create new pending evidence when no prior mutation is pending

The terminal state and run state must agree after every processed transition.

### Completion gate

`riqor run complete` succeeds only when:

- The run belongs to the current repository
- The run is active
- No verification is pending
- Repository identity can be resolved

A successful completion appends `run_completed`, sets `completedAt`, and removes the active pointer atomically.

### Compatibility

Phase 1 must preserve:

- Existing `riqor install`, `doctor`, `status`, `uninstall`, and `codex` behavior
- Existing `codex-harness` aliases
- Existing plugin package layout
- Existing shell hook command syntax
- Existing terminal state file version
- Node.js 22 and Bun 1.3.14 baselines
- No new runtime dependency
- No daemon, network listener, or telemetry upload

## Later Phases

### Phase 2: Assured Profile and Ledger

Add phases, task cards, acceptance checks, evidence-on-close, pause and defer states, failure attribution, and state-adaptive activator context.

### Phase 3: Ecosystem Discovery

Add read-only adapters for agent-kernel, delegate-team, and dokion. Adapters report version, health, and capabilities through bounded subprocess calls with `shell: false`, timeouts, and bounded output.

### Phase 4: Checkpoints and Lineage

Add checkpoint creation, resume validation, parent and child run references, sanitized handoff capsules, run budgets, and approval references bound to operation digests.

### Phase 5: Evaluation and GitHub Plan Bridge

Add deterministic assured-run scenarios and optional import or synchronization with GitHub parent issues and native sub-issues. GitHub writes always require explicit user approval.

## Security Requirements

- Fail closed for state corruption, identity mismatch, approval digest mismatch, and unsafe state paths
- Fail open only for optional advisory hooks and unavailable optional ecosystem providers
- Never persist secrets or raw command text
- Bound all stored strings and metadata counts
- Reject unknown schema versions
- Reject path traversal and symlink substitution
- Keep ecosystem adapters read-only until a later reviewed design explicitly authorizes writes

## Test Strategy

Phase 1 requires:

- Unit tests for goal normalization, repository identity, run creation, active pointer handling, trace ordering, lock recovery, and completion
- Terminal regression tests for failed mutation behavior and transition metadata
- CLI tests for start, status, complete, show, and export
- Privacy tests proving raw command and secret markers are absent from run and trace files
- Existing full test suite
- Package build, tarball inspection, package tests, plugin health, skills health, and action pin verification

## Acceptance

Phase 1 is accepted only when a fresh repository fixture can:

1. Start a run
2. Record a successful mutation without persisting raw command text
3. Reject completion while verification is pending
4. Record a successful verification
5. Complete the run
6. Export an ordered JSONL trace
7. Pass the full repository verification gate
