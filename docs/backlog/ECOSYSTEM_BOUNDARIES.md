# Ecosystem Ownership Boundaries

Riqor coordinates evidence and execution state without absorbing the core responsibilities of its supporting projects

| Project | Owns | Riqor integration boundary |
| --- | --- | --- |
| Riqor | session supervision, evidence, trace, completion gates, checkpoints, backlog execution contracts | local runtime and adapter contracts |
| agent-kernel | project rules, durable memory, failure lessons, persistent proposals | read-only capability, health, and provenance summaries |
| delegate-team | agent selection, delegation, executor and verifier assignment | child-run references and bounded evidence summaries |
| dokion | Playbook execution, permissions, repair, verification, Playbook approvals | read-only run status and verified evidence |
| Codex Security | security scans and finding validation | validated finding references |
| Creative | interactive web development capabilities | declared capability manifest |

## Decision Test

Before accepting an item:

1. Identify the project that owns the core behavior
2. Keep the implementation in that project
3. Add only a versioned adapter or evidence contract to Riqor
4. Reject direct duplication
5. Record collaborators in the item

## Forbidden Duplication in Riqor

- long-term memory backend
- agent selection and swarm routing
- Playbook execution
- project-specific creative implementation
- security scanner implementation

## Adapter Requirements

Every ecosystem adapter must be:

- versioned
- bounded
- read-only in its first release
- timeout protected
- explicit about missing-provider behavior
- provenance preserving
- free of raw prompts, transcripts, credentials, and source contents
