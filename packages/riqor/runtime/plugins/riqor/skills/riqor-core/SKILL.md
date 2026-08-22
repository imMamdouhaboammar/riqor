---
name: riqor-core
description: Use when ChatGPT or Codex needs to choose among Riqor specialist Skills, operate the local Riqor runtime safely, or select the correct evidence workflow for a task.
---

# Riqor Core

Use Riqor as a specialist capability pack plus an evidence and continuity runtime, not as a substitute for repository tests or engineering judgment.

## Start

1. For a general task, read `references/specialists.md` and choose the closest specialist Skill before execution
2. In ChatGPT or Codex, load that specialist Skill and follow it for the task
3. When a local Riqor runtime is available, run `riqor version --json` and `riqor status --json`
4. Run `riqor doctor --json` when local installation or integration health matters
5. Read repository-local instructions before changing files
6. Prefer a repository-scoped Riqor run for multi-step local implementation work

## Runtime boundaries

- The published package requires Node.js 22+
- Bun may be used for Riqor repository development but must not be required by the installed package lifecycle
- Codex features require Codex CLI; package installation may succeed without Codex
- Bundled Riqor Skills can execute as plugin capabilities in ChatGPT and Codex; the npm CLI and lifecycle-hook runtime require a host that exposes the corresponding local execution surface
- Local state must not retain prompts, transcripts, source contents, raw command output, environment values, credentials, cookies, or tokens

## Operating rules

- Treat `riqor doctor` output as evidence, not a guarantee that unrelated project code is correct
- Do not overwrite foreign executables, plugin directories, or shell configuration
- Do not attach the activator to sessions that were not launched by Riqor
- Use focused verification after every successful workspace mutation
- If Riqor and repository instructions conflict, preserve repository safety constraints and report the conflict

## Specialist routing

`references/specialists.md` is the generated index of all 101 paired specialist Skills. Use it when the request names Riqor generally or when more than one specialist could apply. Do not claim a specialist was loaded unless the current surface actually invoked or read that Skill.

## Related skills

Use `riqor-evidence` for run traces, `riqor-managed-codex` for managed Codex sessions, `riqor-diagnostics` for failures, `riqor-security` for trust-boundary work, and `riqor-release` for publishing Riqor itself
