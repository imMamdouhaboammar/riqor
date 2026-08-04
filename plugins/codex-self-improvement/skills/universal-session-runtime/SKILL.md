---
name: universal-session-runtime
description: Use the local Codex Self Improvement runtime consistently across Codex App, Codex CLI, Kaku, and ChatGPT-controlled terminal sessions
---

# Universal Session Runtime

Use this skill when the task touches local execution, plugin health, Kaku, shell integration, or continuity across Codex surfaces

## Runtime commands

- `codex-harness status --json` reports installed versions, enabled plugin state, shell files, and supported surfaces
- `codex-harness doctor --json` runs bounded Codex, plugin, shell, and Kaku health checks
- `codex-harness paths list --json` shows the reviewed execution paths and their approval boundaries
- `codex-harness terminal status --json` reports whether a successful mutation still needs fresh verification
- `codex-harness codex <args>` launches the original Codex binary with the harness environment enabled

## Surface behavior

Codex App and Codex CLI load the native plugin from the shared Codex home

Kaku loads the shell integration and records bounded command metadata with the real shell exit code

A ChatGPT session controlling Kaku inherits the Kaku hooks and environment

A ChatGPT conversation does not execute this local plugin inside the hosted conversation runtime

## Boundaries

Never replace the original `codex` or `kaku` executable

Never persist raw prompts, command bodies, output, source contents, credentials, personal data, or hidden reasoning

Treat connector prose as unverified unless the tool provides a structured success value or a later focused check supplies evidence

Use `codex-harness shell uninstall` or `codex-harness uninstall` for reviewed rollback
