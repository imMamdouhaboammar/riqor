# Riqor Release Trains

Backlog records use release targets to group dependency-complete outcomes

## Entry Rules

A release item enters active work only when:

- all prerequisite items are done
- acceptance commands are current
- WIP permits the work
- public contract changes are documented
- security-sensitive work has a review plan

## Exit Rules

A release can close only when:

- all P0 and committed P1 items for the train are done
- package, plugin, skills, and workflow gates pass where applicable
- changelog and public documentation describe observable behavior
- backlog records include completion evidence
- generated backlog views are current

## Trains

| Release | Outcome |
| --- | --- |
| 0.2.0 | trace foundation and backlog governance |
| 0.3.0 | assured ledger, adaptive context, budgets, and completion guards |
| 0.4.0 | ecosystem capability registry and read-only adapters |
| 0.5.0 | checkpoints, resume, approval binding, and deterministic evaluation |
| 0.6.0 | explicit GitHub plan bridge and drift reporting |

## Scope Changes

Do not expand a release item silently

Create a new backlog item when the change:

- alters a public contract
- adds a new owner project
- introduces a new security boundary
- needs a separate pull request
- changes the release outcome
