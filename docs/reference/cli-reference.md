# CLI Reference: Riqor Command Line Interface

This document contains the complete technical specification for the `riqor` CLI, including subcommands, options, exit codes, environment variables, and compatibility aliases (`codex-harness` and `cxh`).

---

## Global Options

| Flag | Description | Supported Commands |
| --- | --- | --- |
| `--json` | Output structured JSON instead of human-readable text | `status`, `doctor`, `run status`, `trace show`, `terminal status`, etc. |
| `--help`, `-h` | Display command usage and option details | All commands |
| `--version`, `-v` | Display version information | `version` |

---

## Command Catalog

### 1. Package & Diagnostics Commands

#### `riqor install`
Installs the versioned package payload, creates shims in `~/.local/bin`, updates the `current` symlink, configures shell hooks, and writes the install manifest.
```bash
riqor install
```

#### `riqor uninstall`
Safely removes Riqor-managed shims, version directories, and shell integration hooks while preserving foreign executable files.
```bash
riqor uninstall
```

#### `riqor doctor`
Runs health, platform, and SHA-256 provenance integrity checks across package files and agent integrations.
```bash
riqor doctor [--json] [--package-only]
```

#### `riqor status`
Outputs the current version, plugin status, and active local integrations.
```bash
riqor status [--json]
```

#### `riqor version`
Outputs Riqor CLI and bundled plugin version strings.
```bash
riqor version [--json]
```

---

### 2. Managed Agent Session Commands

#### `riqor codex`
Spawns a managed Codex CLI child process with Riqor environment variables and hooks attached.
```bash
riqor codex [--activator] [--activator-interval <duration>] [--activator-watchdog <duration>] [codex-args...]
```

#### `riqor agy`
Spawns a managed Google Antigravity (`agy` / `antigravity`) CLI child process with Riqor hooks attached.
```bash
riqor agy [--activator] [--activator-interval <duration>] [--activator-watchdog <duration>] [agy-args...]
```

**Activator Options**:
- `--activator`: Enables periodic checkpoint reviews.
- `--activator-interval <duration>`: Time between reviews (Default: `15m`, Range: `1m` to `24h`).
- `--activator-watchdog <duration>`: Watchdog limit for review phase (Default: `3m`, Range: `10s` to `30m`).

---

### 3. Repository Assurance & Run Commands

#### `riqor run start`
Starts a repository-scoped run bound to a goal.
```bash
riqor run start --goal "<goal-text>" [--path <path-id>] [--profile <standard|assured>] [--parent-run <id>] [--json]
```

#### `riqor run status`
Shows the active run status for the current repository.
```bash
riqor run status [--run <run-id>] [--json]
```

#### `riqor run complete`
Finalizes and completes the active run if verification state is `clear`. Rejects completion if verification is `verification-pending`.
```bash
riqor run complete [--json]
```

---

### 4. Trace Inspection Commands

#### `riqor trace show`
Outputs the ordered event history for a run.
```bash
riqor trace show <run-id|active> [--json]
```

#### `riqor trace export`
Exports the run event stream in JSON Lines (`jsonl`) format.
```bash
riqor trace export <run-id|active> --format jsonl
```

---

### 5. Terminal State & Evidence Commands

#### `riqor terminal status`
Inspects the current terminal evidence state (`clear` or `verification-pending`).
```bash
riqor terminal status [--session <id>] [--json]
```

#### `riqor evidence`
Reads or appends an entry to the local evidence ledger.
```bash
riqor evidence [--json]
riqor evidence add <mutation|verification|checkpoint|audit> "<message>" [--json]
```

---

## Command Exit Codes

| Exit Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | General error or failed assertion |
| `64` | Invalid command usage or parameter syntax error |
| `70` | Internal state corruption or invariant failure |

---

## Compatibility Aliases

The commands `codex-harness` and `cxh` are registered as compatibility aliases resolving directly to the `riqor` CLI binary:

```bash
codex-harness doctor --json
cxh status --json
```
