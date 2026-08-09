---
name: riqor-core
description: Use when an AI coding agent needs to operate Riqor safely, identify the installed runtime, or choose the correct Riqor workflow before changing a repository.
---

# Riqor Core

Use Riqor as an evidence and continuity runtime, not as a substitute for repository tests or engineering judgment.

## Start

1. Run `riqor version --json`
2. Run `riqor status --json`
3. Run `riqor doctor --json` when installation or integration health matters
4. Read repository-local instructions before changing files
5. Prefer a repository-scoped Riqor run for multi-step implementation work

## Runtime boundaries

- The published package requires Node.js 22+
- Bun may be used for Riqor repository development but must not be required by the installed package lifecycle
- Codex features require Codex CLI; package installation may succeed without Codex
- Riqor does not execute inside hosted ChatGPT conversations
- Local state must not retain prompts, transcripts, source contents, raw command output, environment values, credentials, cookies, or tokens

## Operating rules

- Treat `riqor doctor` output as evidence, not a guarantee that unrelated project code is correct
- Do not overwrite foreign executables, plugin directories, or shell configuration
- Do not attach the activator to sessions that were not launched by Riqor
- Use focused verification after every successful workspace mutation
- If Riqor and repository instructions conflict, preserve repository safety constraints and report the conflict

## Related skills

Use `riqor-evidence` for run traces, `riqor-managed-codex` for managed Codex sessions, `riqor-diagnostics` for failures, `riqor-security` for trust-boundary work, and `riqor-release` for publishing Riqor itself
