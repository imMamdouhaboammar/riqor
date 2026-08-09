# How to Set Up Session Activator Checkpoints

This guide explains how to configure and customize **Session Activator Checkpoints** for Codex and Google Antigravity (`agy`) sessions managed by Riqor.

---

## Overview

The **Session Activator** introduces periodic, structured review checkpoints during an active AI coding session. When the interval expires, Riqor waits for the next safe lifecycle boundary (`Stop` event) and prompts the agent to:
1. Restate the current goal and success criteria.
2. Review file diffs, test results, and recent progress.
3. Detect scope drift, repeated work, or stale assumptions.
4. Continue with the smallest necessary correction.

---

## Starting an Activator Session

To enable the activator, pass the `--activator` flag when starting an agent session:

```bash
# Managed Codex Session
riqor codex --activator

# Managed Antigravity (AGY) Session
riqor agy --activator
```

---

## Customizing Timing Bounds

You can customize the interval between checkpoints and the watchdog limit using duration flags.

```bash
riqor codex --activator \
  --activator-interval 20m \
  --activator-watchdog 3m
```

### Supported Timing Limits

| Flag | Default | Minimum | Maximum | Purpose |
| --- | ---: | ---: | ---: | --- |
| `--activator-interval` | `15m` | `1m` | `24h` | Time between eligible checkpoint reviews |
| `--activator-watchdog` | `3m` | `10s` | `30m` | Max duration allowed for one review phase |

### Accepted Duration Units

- `ms` — Milliseconds
- `s` — Seconds
- `m` — Minutes
- `h` — Hours

---

## How the Watchdog Works

The **watchdog** prevents an agent from getting stuck in an infinite review loop. If the review phase exceeds the specified watchdog duration:

1. Riqor logs a watchdog expiration event.
2. Riqor resets the checkpoint cycle.
3. The session continues normally without killing the agent process.

> **Note**: The watchdog is a checkpoint safety bound, not a process terminator. To stop a stuck agent process, use standard terminal controls (`Ctrl+C`).

---

## Environment Variable Inheritance & Isolation

- Activator settings are scoped strictly to the child process spawned by `riqor codex` or `riqor agy`.
- Closing the child process immediately terminates activator state.
- Subprocesses or secondary terminals do not inherit activator state unless explicitly launched with `riqor codex --activator`.

---

## Disabling the Activator

To run an agent session without periodic checkpoints, simply omit the `--activator` flag:

```bash
riqor codex
```

Or for AGY:

```bash
riqor agy
```
