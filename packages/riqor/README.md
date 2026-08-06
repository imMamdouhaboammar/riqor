<div align="center">

# riqor

**Proof before done**

Evidence gates and managed Codex checkpoints for local coding sessions

</div>

`riqor` is the official npm distribution of [Riqor](https://github.com/imMamdouhaboammar/riqor).

It installs a versioned local runtime, command shims, shell integration, and the bundled Codex plugin. The CLI can track verification state and start Codex sessions with an optional periodic task checkpoint.

## Requirements

- macOS or Linux
- Node.js 22 or newer
- Python 3 for managed shell integration
- Codex CLI for Codex features

## Install

```bash
npx riqor install
```

Confirm the installation:

```bash
riqor version --json
riqor status --json
riqor doctor --json
```

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
~/.local/state/riqor/
~/.local/bin/riqor
```

Run `riqor uninstall` for managed rollback.

## Privacy and Scope

Riqor runs locally and does not install a network listener. Activator state does not retain prompts, transcripts, commands, source contents, or credentials. The activator does not discover or attach to external Codex sessions.

## Documentation

- [Getting started](https://github.com/imMamdouhaboammar/riqor/blob/main/docs/GETTING_STARTED.md)
- [CLI reference](https://github.com/imMamdouhaboammar/riqor/blob/main/docs/CLI_REFERENCE.md)
- [Architecture](https://github.com/imMamdouhaboammar/riqor/blob/main/docs/ARCHITECTURE.md)
- [Security model](https://github.com/imMamdouhaboammar/riqor/blob/main/docs/SECURITY_MODEL.md)
- [Troubleshooting](https://github.com/imMamdouhaboammar/riqor/blob/main/docs/TROUBLESHOOTING.md)

## License

MIT
