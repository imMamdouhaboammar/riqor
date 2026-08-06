# Riqor Backlog and Development Path Design

**Date:** 2026-08-07  
**Status:** Approved  
**Owner:** Riqor maintainers

## Purpose

Riqor needs one durable development backlog that can be read by maintainers, coding agents, and GitHub workflows without relying on chat history or a GitHub Project view. The backlog must describe the work, its order, acceptance checks, evidence requirements, dependencies, ecosystem ownership, and release target.

The design uses a hybrid model:

- Versioned YAML records in `backlog/` are the source of truth
- `BACKLOG.md` and `docs/backlog/CURRENT.md` are generated human-readable views
- GitHub Issues and pull requests are execution mirrors
- Superpowers specifications and plans remain the detailed design history for substantial changes

## Design Inputs

The backlog adopts useful process controls from three reference projects without copying their runtime scope:

- LightAgent: structured lifecycle state, traceable approvals, deterministic evaluation, checkpoint and recovery planning
- fable5-mode: plan gates, small execution cards, evidence-on-close, failure attribution, external progress state
- Codely Agent Harness: reviewable vertical slices, explicit public contracts, one phase per implementation cycle, GitHub issue mirrors

Riqor does not absorb provider routing, long-term memory, swarm execution, or Playbook execution. Those remain owned by the supporting projects.

## Source of Truth

`backlog/initiatives/*.yml` and `backlog/items/*.yml` are authoritative.

Generated views:

- `BACKLOG.md`: portfolio summary and current focus
- `docs/backlog/CURRENT.md`: active work, next queue, blockers, and WIP limits

GitHub Issues are not authoritative. A closed issue does not complete an item until the YAML record is updated and the required evidence exists.

## Backlog Units

### Initiative

An initiative is a multi-release outcome composed of related backlog items.

Required fields:

- Stable ID
- Problem and intended outcome
- Priority and lifecycle status
- Scope and explicit exclusions
- Owned item IDs
- Release targets
- Success measures
- Inspiration sources and concepts

### Item

An item is the smallest independently reviewable delivery unit.

Required fields:

- Stable ID and initiative
- Observable problem and outcome
- Included and excluded scope
- Dependencies
- Machine-checkable acceptance commands
- Evidence requirements
- Risk classification
- GitHub mirror metadata
- Release target
- Inspiration sources

Items must be sized so one pull request can deliver the observable outcome. A broad item must be split before entering `ready`.

## Lifecycle

Allowed item states:

- `proposed`
- `accepted`
- `ready`
- `in-progress`
- `blocked`
- `review`
- `done`
- `deferred`
- `rejected`

Allowed initiative states:

- `planned`
- `active`
- `paused`
- `complete`

Transition rules:

- `proposed → accepted`: problem, outcome, and ownership are clear
- `accepted → ready`: scope, dependencies, acceptance, evidence, risk, and release target are complete
- `ready → in-progress`: branch, owner, and GitHub execution mirror are known
- `in-progress → review`: all item acceptance commands pass on the current head
- `review → done`: pull request is merged, evidence is recorded, documentation is synchronized, and the item record is updated
- Any active state may move to `blocked` only with a blocker reason, owner, and next action
- Completed work is not reopened by editing history; create a new linked item

## Priorities

- `P0`: release, security, or data integrity blocker
- `P1`: required for the current development path
- `P2`: high-value work after the current path
- `P3`: optional improvement
- `icebox`: uncommitted idea

Ordering uses priority, dependency order, risk reduction, user value, release target, and readiness. Priority alone does not override an unmet dependency.

## WIP Limits

- At most one `in-progress` item per initiative
- At most two runtime implementation pull requests across Riqor
- At most one governance or documentation pull request
- At most one release pull request
- A phase in `review` blocks the next dependent phase

These limits are validated by `backlog:lint`.

## Definition of Ready

An item can be `ready` only when it has:

- One owner project
- A precise problem and observable outcome
- Included and excluded scope
- Dependency references
- At least one executable acceptance command
- Required evidence types
- Risk level and affected risk areas
- Release target
- No unresolved dependency cycle
- No unresolved blocker

## Definition of Done

An item can be `done` only when:

- Acceptance commands passed on the current commit
- The applicable repository gate passed
- Review findings are resolved
- Security review exists when required
- Public documentation is synchronized
- The GitHub issue is closed by the merged pull request or carries an explicit closure reason
- Completion evidence is recorded in the item
- Generated backlog views match the source records

## Ecosystem Ownership

| Project | Owns | Riqor may consume |
| --- | --- | --- |
| Riqor | session supervision, evidence, trace, completion gates, checkpoints, backlog execution contracts | local adapter contracts |
| agent-kernel | project rules, durable memory, failure lessons, persistent proposals | bounded capability and read-only status |
| delegate-team | agent selection, delegation, executor and verifier assignment | child-run references and evidence summaries |
| dokion | Playbook execution, permissions, repair, verification, Playbook approvals | run status and verified evidence |
| Codex Security | security scanning and finding validation | validated finding references |
| Creative | interactive web experience development capabilities | declared capability manifests |

A Riqor backlog item that duplicates another project's owned capability must be rejected, narrowed to an adapter, or transferred to the owning repository.

## Initial Initiatives

### RIQ-001 Assured Execution

Build the execution discipline above the Phase 1 trace foundation:

- trace foundation merge
- ledger and cards
- state-adaptive context
- failure attribution and budgets
- phase boundary guards

### RIQ-002 Ecosystem Integration

Add bounded discovery and read-only adapters for:

- capability registry
- agent-kernel
- delegate-team
- dokion

### RIQ-003 Recovery and Review

Add:

- checkpoints
- repository-bound resume
- approval digest binding

### RIQ-004 Deterministic Evaluation

Add:

- assured execution regression scenarios
- privacy and leakage regression coverage

### RIQ-005 GitHub Plan Bridge

Add:

- parent and phase issue creation
- backlog drift reporting

## Release Path

### 0.2.0

- PR #8 trace foundation
- backlog foundation
- lint and generated report commands

### 0.3.0

- assured ledger and cards
- state-adaptive context
- failure attribution and budgets
- phase completion guards

### 0.4.0

- capability registry
- read-only ecosystem adapters
- child-run lineage contract

### 0.5.0

- checkpoints and resume
- approval binding
- deterministic evaluation pack

### 0.6.0

- GitHub plan bridge
- drift detection
- generated run and phase reports

## Repository Layout

```text
BACKLOG.md
backlog/
  initiatives/
  items/
  archive/
docs/backlog/
  README.md
  ROADMAP.md
  CURRENT.md
  TRIAGE.md
  ECOSYSTEM_BOUNDARIES.md
  RELEASE_TRAINS.md
schemas/
  backlog-initiative.schema.json
  backlog-item.schema.json
scripts/
  backlog-lib.ts
  backlog-lint.ts
  backlog-report.ts
test/
  backlog-schema.test.ts
  backlog-integrity.test.ts
```

## Commands

```bash
bun run backlog:lint
bun run backlog:report
bun run backlog:sync
bun run backlog:check
```

- `backlog:lint` validates records and cross-record invariants
- `backlog:report` prints the generated portfolio summary
- `backlog:sync` rewrites generated views
- `backlog:check` fails when records or generated views are stale

## Security and Privacy

The backlog stores no prompts, transcripts, source contents, environment values, credentials, tokens, private local paths, or command output.

Acceptance commands are repository commands, not captured output. Evidence records are references and digests, not raw sensitive payloads.

Scripts:

- read only repository-local YAML and Markdown
- do not invoke a shell
- do not call external services
- do not mutate files unless `backlog-report.ts --write` is explicitly used
- reject malformed records, path mismatches, duplicate IDs, unknown references, cycles, and invalid transitions

## Testing

The repository tests must cover:

- YAML parsing and required fields
- filename and ID consistency
- initiative-to-item references
- dependency existence and cycle detection
- state-specific requirements
- WIP limits
- generated view drift
- required documentation and issue forms
- the current PR #8 item and release path

## Explicit Exclusions

The first backlog foundation pull request does not:

- create runtime Riqor commands
- write to GitHub Issues automatically
- close issues automatically
- create or modify GitHub Projects
- route tasks to other agents
- write agent-kernel memory
- execute Delegate Team tasks
- execute Dokion Playbooks
- publish packages or releases

Those capabilities require separate reviewed backlog items.
