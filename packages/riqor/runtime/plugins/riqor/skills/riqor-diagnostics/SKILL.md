---
name: riqor-diagnostics
description: Use when an AI coding agent needs to diagnose Riqor installation, package integrity, shell integration, plugin state, or managed-session failures.
---

# Riqor Diagnostics

Diagnose from the narrowest boundary outward and preserve the original failure evidence

## First checks

```bash
riqor version --json
riqor status --json
riqor doctor --json
```

Use `riqor doctor --package-only --json` when testing the npm payload without requiring Codex

## Classify the failure

- Package metadata or provenance: inspect the installed versioned payload and provenance result
- Executable ownership: verify `riqor`, `codex-harness`, and `cxh` are Riqor-managed before replacing anything
- Shell integration: inspect managed markers and XDG paths; malformed markers must fail closed
- Codex plugin: use an isolated `CODEX_HOME` for reproduction and do not reuse personal auth state in fixtures
- Activator: confirm the session was launched by `riqor codex --activator` and inspect timing boundaries
- Evidence state: distinguish a real verification-pending transition from stale or malformed state

## Recovery rules

- Preserve foreign files and executables
- Never follow a symlink and overwrite its target during repair
- Back up user shell configuration before a managed rewrite
- Prefer idempotent repair followed by a fresh doctor run
- Do not delete repository run records merely to make diagnostics green

After a repair, rerun the exact failing check and then the relevant package or repository regression suite
