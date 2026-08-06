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
- **Privacy & Secrets**: Commands and source contents are not retained
  in Riqor state.
- **Explicit Approval Gating**: High-risk or durable learning actions require
  explicit human approval.

## Disabling & Rollback

Uninstall Riqor and revert all managed shell integration shims cleanly:

```bash
riqor uninstall
```

## License

Riqor is released under the [MIT License](LICENSE).
