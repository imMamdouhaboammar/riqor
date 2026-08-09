---
name: riqor-evidence
description: Use when an AI coding agent needs a repository-scoped Riqor run, ordered evidence trace, verification gate, or defensible completion claim.
---

# Riqor Evidence

Completion claims must follow observable verification from the same repository state.

## Start a run

Use one active run per repository and state the goal explicitly

```bash
riqor run start --goal "<specific outcome>" --path evidence-loop --profile assured
```

Inspect state with `riqor run status --json`

## During implementation

- A successful recognized mutation creates pending verification evidence
- A failed mutation does not create fresh success evidence
- A later mutation invalidates earlier verification for completion purposes
- Keep verification focused on the changed behavior first, then run the broader gate required by the repository
- Do not represent prose, masked commands, or an agent statement as test evidence

## Trace review

Use `riqor trace show <run-id> --json` to inspect ordered events and `riqor trace export <run-id> --format jsonl` when machine-readable trace data is needed

Riqor trace state is intentionally bounded and content-free. Do not add raw commands, prompts, command output, source text, or credentials to trace metadata

## Completion

Run the required verification after the final mutation, confirm the run is no longer verification-pending, then use `riqor run complete --json`

If verification fails, preserve the failure as evidence and continue the fix cycle. Never clear pending evidence by assertion alone
