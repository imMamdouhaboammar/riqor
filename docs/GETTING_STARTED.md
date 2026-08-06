# Getting Started

This guide installs Riqor, verifies the local environment, starts a managed Codex session, and explains how to remove the installation.

## 1. Check Requirements

Riqor supports macOS and Linux.

Required for normal use:

- Node.js 22 or newer
- Codex CLI installed and authenticated when using Codex integration
- Python 3 for managed shell integration
- `~/.local/bin` available on `PATH`

Required for repository development:

- Bun 1.3.14
- zsh for shell integration tests

Check the main tools:

```bash
node --version
python3 --version
codex --version
```

## 2. Install Riqor

### npx

```bash
npx riqor install
```

### Homebrew

```bash
brew install imMamdouhaboammar/tap/riqor
riqor install
```

The installer copies a versioned payload, updates the `current` symlink, creates command shims, attempts shell integration, writes an install manifest, and runs package diagnostics.

## 3. Confirm the Command Is Available

```bash
riqor version
riqor status
```

When the shell cannot find `riqor`, check the executable and your `PATH`:

```bash
ls -la ~/.local/bin/riqor
echo "$PATH"
```

Add this line to the relevant shell profile when `~/.local/bin` is missing:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Open a new terminal or reload the shell profile before retrying.

## 4. Run Diagnostics

```bash
riqor doctor
```

For machine-readable output:

```bash
riqor doctor --json
```

To inspect only the packaged payload and supported platform checks:

```bash
riqor doctor --package-only --json
```

A full doctor report checks:

- package version
- payload provenance file
- supported platform
- installed executable shim
- Codex CLI availability
- Codex core checks
- Kaku CLI availability

The current full doctor treats a missing Kaku command as a failed check. Direct `riqor codex` use does not require launching Kaku. Use `--package-only` when you need to validate the package without local Codex and Kaku integrations.

Some non-core Codex findings appear under `externalIssues`. Review them separately from the core pass or fail result.

## 5. Start Codex Through Riqor

Without periodic checkpoints:

```bash
riqor codex
```

With the session activator:

```bash
riqor codex --activator
```

Custom timing:

```bash
riqor codex --activator \
  --activator-interval 20m \
  --activator-watchdog 2m
```

Accepted duration suffixes are `ms`, `s`, `m`, and `h`.

| Option | Default | Minimum | Maximum |
| --- | ---: | ---: | ---: |
| `--activator-interval` | `15m` | `1m` | `24h` |
| `--activator-watchdog` | `3m` | `10s` | `30m` |

Timing options require `--activator`. Invalid values are rejected before Codex starts.

## 6. Check Verification State

Riqor shell hooks track successful commands that mutate the workspace.

```bash
riqor terminal status
```

Possible text output:

```text
clear
verification-pending
```

Use JSON when integrating the state into another local tool:

```bash
riqor terminal status --json
```

When verification is pending, run checks that match the changed area. Examples include a focused test, type check, lint command, build, package inspection, or repository-specific validation.

## 7. Inspect Installed Surfaces

```bash
riqor plugin status --json
riqor shell status --json
riqor paths list
```

The compatibility aliases `codex-harness` and `cxh` point to the same Riqor CLI.

## 8. Disable the Activator

The activator is opt-in. Start Codex without `--activator`:

```bash
riqor codex
```

Closing the managed Codex child process ends the activator for that session. Riqor does not install an activator daemon.

## 9. Uninstall

```bash
riqor uninstall
```

The package uninstaller removes the `riqor`, `codex-harness`, and `cxh` shims, invokes the managed shell uninstaller when present, removes the active symlink and versioned Riqor data directory, and deletes the install manifest.

After uninstalling, confirm the result:

```bash
command -v riqor || true
ls -la ~/.config/riqor ~/.local/share/riqor ~/.local/state/riqor 2>/dev/null || true
```

The installer state directory may remain when it contains no managed file targeted by the package uninstaller. Inspect it before deleting anything manually.

See [Troubleshooting](TROUBLESHOOTING.md) when installation, diagnostics, or shell integration does not behave as expected.
