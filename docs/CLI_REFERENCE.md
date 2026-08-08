# CLI Reference

Riqor exposes the `riqor` command plus the compatibility aliases `codex-harness` and `cxh`.

```text
riqor <command> [subcommand] [options]
```

## Global Output Option

Several status and diagnostic commands accept `--json`.

```bash
riqor status --json
riqor doctor --json
riqor run status --json
riqor trace show <run-id> --json
riqor terminal status --json
```

Use JSON output for scripts and integrations. Text output is intended for terminal use.

## Package Commands

### `riqor version`

Reports the Riqor package version and bundled plugin version.

```bash
riqor version --json
```

### `riqor status`

Reports the package version, plugin version, and known integration surfaces.

```bash
riqor status
riqor status --json
```

### `riqor doctor`

Checks package health and the local environment.

```bash
riqor doctor
riqor doctor --json
riqor doctor --package-only --json
```

Options:

| Option | Meaning |
| --- | --- |
| `--json` | Print a structured report |
| `--package-only` | Skip installed shims, Codex, and Kaku checks |

Exit status is non-zero when required checks fail.

### `riqor install`

Installs the versioned package payload and managed local integrations with ownership checks and package integrity verification.

```bash
riqor install
```

The command creates versioned package data, updates the `current` symlink, creates executable shims only when their existing paths are safe to replace, installs shell integration, registers the bundled Codex plugin when Codex CLI is available, writes an install manifest, verifies packaged SHA-256 provenance, and returns a rollback command. Bun is not required for the published package install path.

### `riqor uninstall`

Removes the Riqor-managed installation. Unknown executable paths and unsafe current-link targets are preserved and reported instead of being deleted.

```bash
riqor uninstall
```

## Run Commands

A run is a repository-scoped record that binds a goal, workflow path, execution profile, evidence state, and ordered trace to the current repository identity.

### `riqor run start`

Starts the only active run for the current repository.

```bash
riqor run start \
  --goal "Add resumable trace records" \
  --path evidence-loop \
  --profile assured
```

Options:

| Option | Default | Meaning |
| --- | --- | --- |
| `--goal <text>` | required | Explicit run goal, limited to 2,000 characters |
| `--path <id>` | `evidence-loop` | Existing reviewed workflow path |
| `--profile <id>` | `standard` | `standard` or `assured` |
| `--parent-run <id>` | none | Link this run to a prior run in the same repository |
| `--json` | off | Print the persisted run record |

Starting a second active run in the same repository is rejected. Riqor does not derive the goal from a prompt or conversation transcript.

### `riqor run status`

Shows the active run for the current repository.

```bash
riqor run status
riqor run status --json
```

Inspect a completed or otherwise inactive run explicitly:

```bash
riqor run status --run <run-id> --json
```

Run status values in this release are:

```text
active
verification-pending
completed
failed
abandoned
```

### `riqor run complete`

Completes the active run only when verification is clear.

```bash
riqor run complete
riqor run complete --json
```

The command fails when the run is `verification-pending`, belongs to another repository identity, or is no longer active. A successful completion records `run_completed` and clears the active pointer.

## Trace Commands

Trace files contain bounded metadata and SHA-256 digests. They do not contain raw command text, command output, prompts, source contents, or environment values.

### `riqor trace show`

Shows ordered events for a run.

```bash
riqor trace show <run-id>
riqor trace show <run-id> --json
```

Initial event types are:

```text
run_started
command_completed
workspace_mutated
verification_required
verification_completed
run_completed
```

### `riqor trace export`

Writes the stored event stream as JSON Lines.

```bash
riqor trace export <run-id> --format jsonl
```

`jsonl` is the only supported export format in this release. Each line is one event in sequence order.

## Codex Commands

### `riqor codex`

Starts Codex as a direct child process with the Riqor environment enabled.

```bash
riqor codex
riqor codex [codex arguments]
```

Riqor uses a direct argument array and does not launch Codex through a shell.

### `riqor codex --activator`

Starts a managed Codex session with periodic task checkpoints.

```bash
riqor codex --activator
```

Options:

| Option | Default | Allowed range | Meaning |
| --- | ---: | ---: | --- |
| `--activator` | off | opt-in | Enable periodic checkpoints for this child process |
| `--activator-interval <duration>` | `15m` | `1m` to `24h` | Time between eligible checkpoint cycles |
| `--activator-watchdog <duration>` | `3m` | `10s` to `30m` | Maximum duration of one review phase |

Duration suffixes:

```text
ms  milliseconds
s   seconds
m   minutes
h   hours
```

Both timing options also accept inline values:

```bash
riqor codex --activator \
  --activator-interval=20m \
  --activator-watchdog=2m
```

Rules:

- Timing options require `--activator`
- Invalid or missing durations are rejected before Codex starts
- Riqor removes its activator options before forwarding the remaining arguments
- Inherited activator environment values are cleared unless the current command opts in
- Activator state applies only to the current managed Codex child process
- Closing the child process ends the activator

Invalid command usage exits with status `64`.

## Terminal State Commands

These commands are normally called by installed shell hooks. They are public for diagnostics and integrations.

### `riqor terminal preexec`

Records a command digest before execution.

```bash
riqor terminal preexec \
  --session <session-id> \
  --command '<command>'
```

`--session` is optional. Riqor otherwise uses the current TTY or parent process identifier. The raw command is classified in memory and is not persisted.

### `riqor terminal postexec`

Records the command exit status and updates verification state.

```bash
riqor terminal postexec \
  --session <session-id> \
  --exit-code 0
```

`--exit-code` must be an integer. When the current repository has an active run, a processed transition also appends bounded trace events to that run.

A successful mutation moves the run to `verification-pending`. A failed mutation does not create fresh pending evidence. A successful recognized verification clears pending evidence.

### `riqor terminal status`

Shows the verification state for a terminal session.

```bash
riqor terminal status
riqor terminal status --json
riqor terminal status --session <session-id>
```

Text output is one of:

```text
clear
verification-pending
```

## Plugin Commands

### `riqor plugin status`

Shows whether the Codex plugin is installed and enabled.

```bash
riqor plugin status
riqor plugin status --json
```

### `riqor plugin install`

Runs the bundled Codex plugin installer. In the published npm package this uses package mode and does not require Bun.

```bash
riqor plugin install
```

### `riqor plugin uninstall`

Runs the bundled Codex plugin uninstaller.

```bash
riqor plugin uninstall
```

## Shell Commands

### `riqor shell status`

Shows detected local shell integration files.

```bash
riqor shell status
riqor shell status --json
```

### `riqor shell install`

Runs the bundled shell integration installer.

```bash
riqor shell install
```

### `riqor shell uninstall`

Removes managed shell integration.

```bash
riqor shell uninstall
```

## Workflow Path Commands

### `riqor paths list`

Lists reviewed workflow paths and their objectives.

```bash
riqor paths list
riqor paths list --json
```

JSON output includes each path identifier, objective, curated skills, required evidence, guardrails, and whether explicit approval is required.

## Compatibility Aliases

These commands resolve to the same packaged CLI:

```bash
codex-harness status
cxh status
```

Use `riqor` in new documentation and scripts. The aliases exist for existing installations and workflows.

## Common Examples

Install and diagnose:

```bash
npx riqor install
riqor doctor --json
```

Start and inspect a run:

```bash
riqor run start --goal "Repair the parser" --profile assured
riqor run status --json
riqor trace show <run-id> --json
```

Start a managed session with defaults:

```bash
riqor codex --activator
```

Start a longer checkpoint cycle:

```bash
riqor codex --activator \
  --activator-interval 30m \
  --activator-watchdog 3m
```

Inspect local state:

```bash
riqor status --json
riqor plugin status --json
riqor shell status --json
riqor terminal status --json
```

Remove the installation:

```bash
riqor uninstall
```
