# How to Troubleshoot & Diagnose Riqor Issues

This guide provides step-by-step diagnostic recipes for resolving common issues with Riqor installation, agent sessions, shell integration, and evidence tracking.

---

## 1. Quick Diagnostic Checklist

Start by running Riqor's diagnostic commands:

```bash
riqor status --json
riqor doctor --json
riqor plugin status --json
riqor shell status --json
```

---

## 2. Common Issues & Solutions

### Problem: `riqor: command not found`

**Cause**: `~/.local/bin` is not present in your `PATH`.

**Solution**:
1. Check if the executable shim exists:
   ```bash
   ls -la ~/.local/bin/riqor
   ```
2. Add `~/.local/bin` to your shell profile (`~/.zshrc` or `~/.bashrc`):
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   ```
3. Source your shell profile or open a new terminal window.

---

### Problem: Unsupported Platform Diagnostic Failure

**Cause**: Riqor currently supports macOS (`darwin`) and Linux (`linux`).

**Solution**:
Check Node.js platform report:
```bash
node -p "process.platform"
```
If using Windows, use Windows Subsystem for Linux (WSL2).

---

### Problem: Node.js Version Incompatibility

**Cause**: Riqor requires Node.js `22.x` or newer.

**Solution**:
Check Node version:
```bash
node --version
```
Upgrade Node.js via your package manager or `nvm` (`nvm use 22`).

---

### Problem: Payload Provenance & SHA-256 Check Failure

**Cause**: Files inside `~/.local/share/riqor/current/runtime/` have been corrupted or manually modified.

**Solution**:
Reinstall the clean versioned package payload:
```bash
riqor uninstall
npx riqor install
```

---

### Problem: `verification-pending` Does Not Clear

**Cause**: The test runner command executed was not recognized by Riqor's shell hooks classifier.

**Solution**:
1. Run a standard recognized test runner (e.g. `bun test`, `npm test`, `pytest`, `cargo test`).
2. Alternatively, manually log a verification entry:
   ```bash
   riqor evidence add verification "Manual check completed" --json
   ```

---

### Problem: Activator Timing Parameters Rejected

**Cause**: `--activator-interval` or `--activator-watchdog` flags passed without `--activator`.

**Solution**:
Ensure `--activator` is included when configuring custom durations:
```bash
# Correct:
riqor codex --activator --activator-interval 20m --activator-watchdog 3m

# Incorrect:
riqor codex --activator-interval 20m
```

---

## 3. Clean Reinstallation & Rollback

To completely remove Riqor and reset local configuration:

```bash
riqor uninstall
```

Verify that shims and payload directories have been safely removed:

```bash
command -v riqor || true
ls -la ~/.config/riqor ~/.local/share/riqor 2>/dev/null || true
```
