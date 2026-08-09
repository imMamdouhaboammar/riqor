<div align="center">

<img src="https://raw.githubusercontent.com/imMamdouhaboammar/riqor/main/docs/assets/logo.svg" alt="Riqor" width="360" />

# riqor

**Proof before done**

Evidence gates, managed checkpoints, and repository-scoped traces for local AI coding sessions

</div>

`riqor` is the official npm package for [Riqor](https://github.com/imMamdouhaboammar/riqor)

## Install

```bash
npx riqor install
```

Or install globally

```bash
npm install -g riqor
riqor install
```

Requirements

- macOS or Linux
- Node.js 22+
- Python 3 for managed shell integration
- Codex CLI for Codex features or Google Antigravity for AGY features

The published package has zero runtime dependencies. Bun is not required for installation or normal use

## Start a managed Codex session

```bash
riqor codex --activator
```

The default checkpoint interval is 15 minutes with a 3 minute watchdog. Custom timing is available when needed

```bash
riqor codex --activator \
  --activator-interval 20m \
  --activator-watchdog 2m
```

Riqor installs **100 distributed native Codex agent configs** into a managed `riqor` profile under `CODEX_HOME`. The bundled plugin exposes the same 100 public specialists as portable Skills for ChatGPT and Codex. Each native agent requires its paired Skill before task execution. `riqor codex` selects the managed profile automatically unless you pass `-p` or `--profile` yourself. Riqor does not add apps, MCP servers, or tool configuration to the profile

The activator applies only to the Codex child process launched by Riqor and waits for a safe lifecycle Stop boundary

Google Antigravity uses the same pattern

```bash
riqor agy --activator
```

## Track evidence for one repository task

```bash
riqor run start \
  --goal "Repair the parser and verify the regression" \
  --path evidence-loop \
  --profile assured

riqor run status --json
riqor trace show <run-id> --json
riqor run complete --json
```

A successful workspace mutation makes verification pending. A recognized passing check after the latest mutation clears that state

## Diagnose the local runtime

```bash
riqor version --json
riqor status --json
riqor doctor --json
```

For package-only verification without Codex

```bash
riqor doctor --package-only --json
```

## Codex Plugin

The repository also publishes a Codex Git marketplace

```bash
codex plugin marketplace add imMamdouhaboammar/riqor --ref main
codex plugin add riqor@riqor
```

The plugin ships 100 generated specialist Skills plus 11 Riqor workflow Skills for setup, evidence, diagnostics, managed sessions, security, and release work. The specialist Skills are directly usable in ChatGPT and Codex after the plugin is installed

## Core commands

| Command | Purpose |
| --- | --- |
| `riqor install` | Install the versioned runtime and managed integrations |
| `riqor uninstall` | Remove Riqor-managed local changes |
| `riqor doctor` | Check package integrity and environment health |
| `riqor status` | Report versions and active surfaces |
| `riqor adoption` | Report local-only adoption counters; Marketplace installs remain unknown |
| `riqor adoption --export <path>` | Export a bucketed receipt without the local installation identifier |
| `riqor adoption --reset` | Delete only the local adoption ledger |
| `riqor run start` | Start a repository-scoped evidence run |
| `riqor run status` | Inspect run and verification state |
| `riqor trace show` | Read ordered evidence events |
| `riqor trace export` | Export evidence events as JSONL |
| `riqor codex --activator` | Start Codex with managed checkpoints |
| `riqor agy --activator` | Start Antigravity with managed checkpoints |
| `riqor terminal status` | Show local evidence status |
| `riqor plugin status` | Show Codex plugin state |

Compatibility aliases remain available as `codex-harness` and `cxh`

## Privacy boundary

Riqor local tooling does not install a network listener. Persisted run, activator, and adoption state excludes prompts, transcripts, source contents, raw commands, command output, environment values, credentials, cookies, and tokens. The adoption ledger is local-only and contains no remote telemetry path

The activator does not discover or attach to unrelated Codex or AGY sessions

## Local files

The installer follows XDG locations when configured. Common defaults include

```text
~/.local/share/riqor/
~/.config/riqor/
~/.local/state/riqor/
~/.local/bin/riqor
```

Legacy compatibility state may still use `~/.config/codex-self-improvement/` and `CODEX_SELF_IMPROVEMENT_DATA`

## Documentation

- [Getting Started](https://github.com/imMamdouhaboammar/riqor/blob/main/docs/GETTING_STARTED.md)
- [CLI Reference](https://github.com/imMamdouhaboammar/riqor/blob/main/docs/CLI_REFERENCE.md)
- [Architecture](https://github.com/imMamdouhaboammar/riqor/blob/main/docs/ARCHITECTURE.md)
- [Agent Skills](https://github.com/imMamdouhaboammar/riqor/blob/main/docs/AGENT_SKILLS.md)
- [Security Model](https://github.com/imMamdouhaboammar/riqor/blob/main/docs/SECURITY_MODEL.md)
- [Troubleshooting](https://github.com/imMamdouhaboammar/riqor/blob/main/docs/TROUBLESHOOTING.md)

## License

MIT
