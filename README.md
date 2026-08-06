# Riqor

AI agents should prove the work

Your coding agent said it was done

Riqor checks the evidence

Riqor adds local hooks, verification gates, reviewed workflows,
and session continuity to Codex App, Codex CLI, and supported terminals.

## Installation

Install Riqor with `npx`:

```bash
npx riqor install
```

Or install via Homebrew:

```bash
brew install imMamdouhaboammar/tap/riqor
riqor install
```

## Quick Start

```text
$ riqor terminal status
verification-pending

$ npm test
42 tests passed

$ riqor terminal status
clear
```

Note: The test count above is an illustrative example.

Check environment health and installed surfaces:

```bash
riqor status
riqor doctor
```

## Codex Session Activator

Start Codex through Riqor and enable a periodic task checkpoint:

```bash
riqor codex --activator
```

The recommended defaults run a checkpoint after each 15 minutes of managed work and give that checkpoint a 3-minute watchdog window:

```bash
riqor codex --activator \
  --activator-interval 15m \
  --activator-watchdog 3m
```

Durations accept `ms`, `s`, `m`, or `h`. The interval must be between 1 minute and 24 hours. The watchdog must be between 10 seconds and 30 minutes.

The activator works only for the Codex process started by that `riqor codex` command. It waits for the next safe Codex `Stop` lifecycle event rather than interrupting an active turn. The checkpoint asks Codex to restore the task goal, inspect current evidence, summarize completed work, detect drift or missing verification, and continue with the smallest relevant correction.

The watchdog prevents a checkpoint from creating a repeated Stop loop. It does not kill the main Codex process. Closing the managed Codex process ends the activator; Riqor does not install a background daemon or attach to unrelated sessions.

## How Riqor Works

Riqor runs a local, privacy-respecting control plane for AI coding assistants.
When an AI agent claims work is finished, Riqor intercepts lifecycle hooks
and requires verifiable evidence (passing tests, lint status, build artifacts)
before accepting completion claims.

## System Boundaries & Security

- **No Model Weight Modification**: Riqor does not modify model weights
  or underlying AI model architecture.
- **No Determinism Claim**: Riqor does not make model output deterministic.
- **Hosted Cloud Boundaries**: Hosted ChatGPT conversations do not execute local Riqor code inside their remote cloud runtime.
- **Terminal Inheritance**: ChatGPT-controlled local terminals inherit Riqor
  only through the local shell and Codex environment.
- **Privacy & Secrets**: Commands, prompts, transcripts, and source contents are not retained in activator state.
- **Managed Scope**: The activator accepts only a random token created for the current `riqor codex` child process and never discovers external Codex sessions.
- **Explicit Approval Gating**: High-risk or durable learning actions require
  explicit human approval.

## Disabling & Rollback

Do not pass `--activator` when starting Codex to leave periodic checkpoints disabled.

Uninstall Riqor and revert all managed shell integration shims cleanly:

```bash
riqor uninstall
```

## License

Riqor is released under the [MIT License](LICENSE).
