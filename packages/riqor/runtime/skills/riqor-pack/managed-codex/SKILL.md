---
name: riqor-managed-codex
description: Use when an AI coding agent needs to launch or reason about a Codex session managed by Riqor, including the optional session activator and watchdog.
---

# Riqor Managed Codex

The activator is valid only for a Codex child process launched through `riqor codex`

## Launch

Standard managed session

```bash
riqor codex
```

Managed session with periodic checkpointing

```bash
riqor codex --activator
```

Custom timing

```bash
riqor codex --activator --activator-interval 20m --activator-watchdog 2m
```

## Safety rules

- Default interval is 15 minutes
- Default watchdog is 3 minutes
- Do not pass activator timing flags without `--activator`
- Riqor removes inherited activator environment values unless the current command opts in
- The activator waits for a safe Codex Stop boundary; it does not inject into an active turn
- Watchdog expiry must fail open and allow the session to continue
- Session state must remain isolated between managed Codex processes
- Do not discover, attach to, or modify unrelated Codex sessions

## Verification

When diagnosing activator behavior, confirm the child was launched by Riqor, inspect bounded state only, reproduce the interval/Stop sequence, and verify SessionEnd removes the managed activator state
