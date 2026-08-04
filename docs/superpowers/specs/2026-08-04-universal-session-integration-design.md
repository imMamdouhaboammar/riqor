# Universal Session Integration Design

## Goal

Make Codex Self Improvement load automatically in Codex App and Codex CLI, and expose the same bounded execution guidance inside Kaku and zsh sessions controlled by ChatGPT

## Runtime boundaries

Codex App and Codex CLI consume the native Codex plugin and hooks from the shared CODEX_HOME

ChatGPT does not execute Codex plugins inside its own conversation runtime, so terminal sessions inherit the behavior through a local shell bootstrap, CLI, and Kaku hooks

The terminal integration stores only bounded metadata such as route, mutation class, verification result, exit code, and hashes

Raw prompts, command bodies, repository contents, credentials, and reasoning traces are not persisted

## Components

- Native Codex plugin with automatic session, prompt, tool, and completion hooks
- `codex-harness` CLI for status, doctor, paths, plugin lifecycle, shell lifecycle, and Codex launch
- Minimal zsh environment bootstrap loaded from `.zshenv`
- Kaku interactive integration loaded from its managed plugin directory
- Terminal evidence state scoped by TTY or parent process
- Reversible installer with backups and explicit health checks

## Automatic behavior

Every Codex App or CLI session loads the enabled plugin from `~/.codex`

Every zsh session receives the harness root, executable path, and stable environment flags

Every Kaku pane discovers curated skills, tracks mutation and verification metadata, wraps Codex without replacing its binary, and exposes evidence status

ChatGPT-controlled Kaku commands pass through the same Kaku hooks when executed in an interactive pane and receive the same environment in non-interactive zsh processes

## Safety and failure handling

Shell bootstraps are idempotent and silent

Failure to read local state is fail-open and visible through doctor output

No daemon, network listener, external processor, or telemetry upload is required

The installer never replaces the original `codex` or `kaku` binaries

All external file changes receive timestamped backups and can be removed through the CLI

## Verification

The release gate includes unit tests, shell syntax checks, simulated zsh sessions, Kaku doctor, Codex doctor, plugin validation, plugin smoke, package reproducibility, and fresh installation checks
