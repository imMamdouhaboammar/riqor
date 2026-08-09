# Tutorial: Getting Started with Riqor in 10 Minutes

**What you'll build**: A fully verified, local AI coding environment running managed agent sessions with automated checkpoints and evidence gates.

**What you'll learn**:
- How to install Riqor and verify package integrity
- How to start a managed session with Codex or Google Antigravity (`agy`)
- How to inspect session diagnostics and status outputs
- How to clean up or uninstall Riqor safely

**Prerequisites**:
- [ ] Operating System: macOS or Linux
- [ ] Node.js: `v22.0.0` or newer ([Download Node.js](https://nodejs.org/))
- [ ] Agent CLI: Codex CLI (`codex`) or Google Antigravity CLI (`agy`) installed and authenticated
- [ ] Shell: `zsh` or `bash` with Python 3 available

---

## Step 1: Install Riqor via npx

First, install Riqor using `npx`. This downloads the payload, creates local executable shims in `~/.local/bin`, and sets up local configuration manifests.

```bash
npx riqor@beta install
```

You should see output similar to:

```text
[riqor] Installing Riqor v0.2.0-beta.3...
[riqor] Created version payload in ~/.local/share/riqor/0.2.0-beta.3
[riqor] Updated current symlink
[riqor] Created shims: riqor, codex-harness, cxh in ~/.local/bin
[riqor] Verification checks passed (SHA-256 provenance valid)
[riqor] Installation complete!
```

> **Tip**: If `riqor: command not found` appears after installation, ensure `~/.local/bin` is present in your `PATH` by adding `export PATH="$HOME/.local/bin:$PATH"` to your `~/.zshrc` or `~/.bashrc`.

---

## Step 2: Run Environment Diagnostics

Before starting your first agent session, verify that all core diagnostic checks pass:

```bash
riqor doctor
```

For structured JSON output suitable for automated scripts:

```bash
riqor doctor --json
```

A healthy diagnostic report checks package payload provenance, platform support, executable shims, and detected agent CLIs.

---

## Step 3: Start a Managed Agent Session

Start an agent session wrapped by Riqor. In a managed session, Riqor tracks workspace changes and runs periodic task checkpoints.

### Option A: Managed Codex Session

```bash
riqor codex --activator
```

### Option B: Managed Antigravity Session (AGY)

```bash
riqor agy --activator
```

### Customizing Checkpoint Timing

By default, the activator reviews progress every 15 minutes with a 3-minute watchdog window. You can customize timing parameters:

```bash
riqor codex --activator \
  --activator-interval 20m \
  --activator-watchdog 3m
```

---

## Step 4: Check Session State

While working in your terminal or during an agent session, check the local verification state:

```bash
riqor terminal status
```

Output will be either:
- `clear`: No unverified workspace mutations detected.
- `verification-pending`: Code or files were changed; a test suite or verification runner should be executed.

To inspect the overall Riqor system status:

```bash
riqor status --json
```

---

## Step 5: What You Accomplished

Congratulations! You have set up Riqor and executed your first managed agent session.

**Here is what you learned**:
- **Installation**: How Riqor deploys versioned payload directories without global system pollution.
- **Diagnostics**: How to run `riqor doctor` to verify environment integrity.
- **Managed Execution**: How `--activator` introduces periodic checkpoints to keep AI sessions focused on measurable goals.

---

## Next Steps

- 📖 Learn how workspace evidence tracking works in the [First Evidence Loop Tutorial](first-evidence-loop-tutorial.md).
- 🛠️ Learn how to configure custom checkpoint intervals in the [Setup Activator Checkpoints Guide](../how-to/setup-activator-checkpoints.md).
- 📑 Look up commands and flags in the [CLI Reference](../reference/cli-reference.md).
