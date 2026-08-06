# Riqor Backlog Operating Guide

The repository backlog is the durable development control surface for Riqor

## Authoritative Files

- `backlog/initiatives/*.yml` defines multi-release outcomes
- `backlog/items/*.yml` defines independently reviewable delivery units
- `BACKLOG.md` is generated portfolio output
- `docs/backlog/CURRENT.md` is generated active-work output
- GitHub Issues and pull requests are execution mirrors

Do not edit generated views directly

## Daily Workflow

1. Read `docs/backlog/CURRENT.md`
2. Confirm the target item is `ready` or already `in-progress`
3. Confirm all dependencies and WIP limits
4. Create or update the GitHub mirror
5. Set the item to `in-progress` and record the pull request
6. Implement one item or one vertical slice
7. Run every acceptance command
8. Move to `review`
9. Merge only after current-head evidence and review
10. Set the item to `done`, add completion evidence, and run `bun run backlog:sync`

## Commands

```bash
bun run backlog:lint
bun run backlog:report
bun run backlog:sync
bun run backlog:check
```

`backlog:check` is the required repository gate for backlog changes

## Proposing Work

Create a new item in `proposed`

The record must state:

- observable problem
- observable outcome
- included and excluded scope
- owner project and collaborators
- dependencies
- executable acceptance
- evidence requirements
- risk
- release target
- inspiration concepts

Use the Backlog Item Issue Form only as a mirror of a committed or proposed source record

## Starting Work

An item cannot start when:

- a dependency is incomplete
- another item in the same initiative is in progress
- global WIP is exceeded
- scope is broad enough to require several pull requests
- acceptance is not executable
- ownership duplicates another ecosystem project

## Closing Work

A completed item requires:

- current-head acceptance results
- applicable repository gate
- resolved review findings
- security review when requested
- synchronized documentation
- completion metadata in the YAML record
- current generated views

## Design History

Large changes also require a Superpowers specification and implementation plan under `docs/superpowers/`
