---
name: riqor-setup
description: Use when Codex needs to install, upgrade, verify, or repair the local Riqor npm runtime required by the Riqor plugin.
---

# Riqor Setup

Use this skill only on a local coding surface with terminal access. Hosted ChatGPT cannot install software on the user's machine.

## Required runtime

- Node.js 22 or newer
- npm authenticated only when publishing Riqor itself
- Codex CLI for managed Codex features

## Install or align the runtime

First inspect the current state:

```bash
node --version
npm --version
command -v riqor || true
riqor version --json 2>/dev/null || true
```

For this plugin release, align the local package to `0.2.0-beta.3`:

```bash
npm install --global riqor@0.2.0-beta.3
riqor version --json
riqor doctor --package-only --json
```

Do not overwrite a foreign executable. If `riqor doctor` reports an ownership or path conflict, stop and diagnose it with `riqor-diagnostics` instead of forcing replacement.

## Repository setup

After package health succeeds, run the smallest setup required by the user's task. Prefer explicit commands and preserve repository-local instructions.

For managed Codex work, use `riqor codex`. For evidence-gated work, use `riqor run start` and the `riqor-evidence` skill.
