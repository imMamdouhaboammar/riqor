<div align="center">

# riqor

**Proof before done**

Evidence gates, repository run traces, and managed Codex checkpoints for local coding sessions

</div>

`riqor` is the official npm distribution of [Riqor](https://github.com/imMamdouhaboammar/riqor).

It installs a versioned local runtime, ownership-checked command shims, shell integration, and the bundled Codex plugin when Codex CLI is available. The CLI can track verification state, maintain a repository-scoped run trace, and start Codex sessions with an optional periodic task checkpoint.

## Requirements

- macOS or Linux
- Node.js 22 or newer
- Python 3 for managed shell integration
- Codex CLI for Codex features; installation can complete without Codex and plugin setup can be run later

## Install

```bash
npx riqor install
```

Bun is not required for the published package install path. When Codex CLI is present, the installer registers the bundled plugin automatically.

Confirm the installation:

```bash
riqor version --json
riqor status --json
riqor doctor --json
```

## Record a Repository Run

Start one active run for the current repository:

```bash
riqor run start \
  --goal "Repair the parser and verify the regression" \
  --path evidence-loop \
  --profile assured
```

Inspect the run and its ordered trace:

```bash
riqor run status --json
riqor trace show <run-id> --json
```

A successful mutation recorded by the shell integration moves the run to `verification-pending`. A successful recognized verification returns it to `active`.

Complete only after verification is clear:

```bash
riqor run complete --json
```

Export trace events as JSON Lines:

```bash
riqor trace export <run-id> --format jsonl
```

Run state stores bounded metadata and digests. It does not store raw command text, command output, prompts, source contents, environment values, credentials, cookies, or tokens.

## Start Codex

Standard managed environment:

```bash
riqor codex
```

Periodic task checkpoints:

```bash
riqor codex --activator
```

Custom timing:

```bash
riqor codex --activator \
  --activator-interval 20m \
  --activator-watchdog 2m
```

The default interval is `15m` and the default watchdog is `3m`. The interval accepts `1m` to `24h`; the watchdog accepts `10s` to `30m`.

The activator applies only to the Codex child process started by that command. It waits for the next safe Codex `Stop` event and does not interrupt an active turn.

## Core Commands

| Command | Purpose |
| --- | --- |
| `riqor install` | Install the runtime payload and local shims |
| `riqor uninstall` | Remove Riqor-managed local changes |
| `riqor status` | Report versions and integration surfaces |
| `riqor doctor` | Check package and local environment health |
| `riqor version` | Report package and plugin versions |
| `riqor run start` | Start a repository-scoped run |
| `riqor run status` | Inspect the active or selected run |
| `riqor run complete` | Complete a verified active run |
| `riqor trace show` | Show ordered trace events |
| `riqor trace export` | Export trace events as JSONL |
| `riqor codex` | Start Codex with the Riqor environment |
| `riqor codex --activator` | Start Codex with periodic task checkpoints |
| `riqor terminal status` | Show local verification state |
| `riqor plugin status` | Show Codex plugin state |
| `riqor shell status` | Show shell integration state |
| `riqor paths list` | List reviewed workflow paths |

Compatibility aliases are included as `codex-harness` and `cxh`.

## Local Files

The installer uses XDG paths when configured. Default locations include:

```text
~/.local/share/riqor/
~/.config/riqor/
~/.config/codex-self-improvement/
~/.local/state/riqor/
~/.local/bin/riqor
```

Set `RIQOR_STATE_HOME` to override the run state root. Terminal verification metadata continues to use `CODEX_SELF_IMPROVEMENT_DATA` when that variable is set.

Run `riqor uninstall` for managed package rollback. Uninstall removes only recognized Riqor or legacy-managed installation paths and reports foreign paths instead of deleting them. Existing repository run records are not silently removed.

## Privacy and Scope

Riqor runs locally and does not install a network listener. Run and activator state do not retain prompts, transcripts, raw commands, command output, source contents, environment values, or credentials. The activator does not discover or attach to external Codex sessions.

Riqor does not provide a model runtime, durable user memory, delegated-agent routing, or Playbook execution.

## Documentation

- [Getting started](https://github.com/imMamdouhaboammar/riqor/blob/main/docs/GETTING_STARTED.md)
- [CLI reference](https://github.com/imMamdouhaboammar/riqor/blob/main/docs/CLI_REFERENCE.md)
- [Architecture](https://github.com/imMamdouhaboammar/riqor/blob/main/docs/ARCHITECTURE.md)
- [Security model](https://github.com/imMamdouhaboammar/riqor/blob/main/docs/SECURITY_MODEL.md)
- [Troubleshooting](https://github.com/imMamdouhaboammar/riqor/blob/main/docs/TROUBLESHOOTING.md)

## License

MIT
