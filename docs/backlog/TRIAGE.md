# Backlog Triage and Lifecycle

## Intake

New work starts as `proposed`

Triage checks:

- Is the problem observable
- Does Riqor own the outcome
- Is the item one pull request in size
- Are included and excluded scope explicit
- Are dependencies real and complete
- Is acceptance executable
- Is evidence proportional to risk
- Does the release target match dependency order

## Status Decisions

| Status | Meaning |
| --- | --- |
| proposed | captured but not committed |
| accepted | direction approved, details may still need work |
| ready | Definition of Ready satisfied |
| in-progress | implementation branch and pull request exist |
| blocked | progress requires a named external action |
| review | acceptance passed and current diff is under review |
| done | merged with evidence and synchronized records |
| deferred | intentionally postponed with reason |
| rejected | not aligned with ownership, scope, or value |

## Priority Decisions

| Priority | Use |
| --- | --- |
| P0 | release, security, or data integrity blocker |
| P1 | required for the current development path |
| P2 | high-value work after the current path |
| P3 | optional improvement |
| icebox | idea without commitment |

## Definition of Ready

- one owner project
- problem and outcome
- included and excluded scope
- dependencies
- executable acceptance
- required evidence
- risk level and areas
- release target
- no cycle
- no unresolved blocker

## Definition of Done

- acceptance passed on current head
- applicable full gate passed
- review threads resolved
- required security review complete
- documentation synchronized
- issue closed by merged pull request or explicit reason
- completion evidence recorded
- generated views current

## WIP

- one in-progress item per initiative
- two runtime items maximum
- one governance or documentation pull request
- one release pull request

`bun run backlog:lint` enforces the machine-checkable limits

## Blocked Work

A blocked record must contain:

```yaml
blocked:
  reason: specific condition preventing progress
  owner: person or project responsible for the next action
  nextAction: observable action that removes the blocker
```

Do not use `blocked` for uncertain scope or incomplete planning
