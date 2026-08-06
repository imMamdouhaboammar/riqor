# Troubleshooting

Start with structured diagnostics:

```bash
riqor status --json
riqor doctor --json
riqor plugin status --json
riqor shell status --json
```

Keep the complete JSON output when opening an issue. Remove usernames, home paths, or other local details that you do not want to share.

## `riqor: command not found`

Confirm the installer created the shim:

```bash
ls -la ~/.local/bin/riqor
```

Confirm `~/.local/bin` is on `PATH`:

```bash
printf '%s\n' "$PATH" | tr ':' '\n'
```

Add it to the relevant shell profile when missing:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Open a new terminal or reload the profile.

## Unsupported Platform Check

The packaged doctor supports macOS and Linux.

```bash
node -p 'process.platform'
```

A `win32` result fails the current supported-platform check. Use a supported environment rather than bypassing the diagnostic.

## Node.js Version Error

The package requires Node.js 22 or newer.

```bash
node --version
```

Upgrade Node, start a new terminal, and rerun:

```bash
riqor doctor --package-only --json
```

## Payload Provenance Is Missing

Check the active payload:

```bash
readlink ~/.local/share/riqor/current
ls -la ~/.local/share/riqor/current/runtime/provenance.json
```

Reinstall from the package when the active payload is incomplete:

```bash
riqor uninstall
npx riqor install
```

For repository development, rebuild and inspect the package:

```bash
bun run riqor:pack
bun run riqor:inspect -- packages/riqor/riqor-*.tgz
```

## Codex CLI Is Missing

```bash
command -v codex
codex --version
```

Install and authenticate Codex before using `riqor codex` or expecting a fully green Codex diagnostic.

Then run:

```bash
codex doctor --json
riqor doctor --json
```

## `codex-core` Fails

Riqor checks these Codex doctor items as core requirements:

- `auth.credentials`
- `config.load`
- `network.provider_reachability`
- `state.paths`

Run Codex diagnostics directly:

```bash
codex doctor --json
```

Fix the failing core item before retrying Riqor. Other Codex findings are returned under `externalIssues`.

## Kaku Is Not Installed

Direct `riqor codex` use does not require launching Kaku. The current full package doctor still includes `kaku-cli` as a required check, so a missing Kaku command makes the full report non-green.

Use the package-only check when validating the package payload without local integrations:

```bash
riqor doctor --package-only --json
```

Install Kaku when you need its interactive shell hooks or a fully green current full-doctor report.

## Plugin Is Missing or Disabled

Inspect the plugin:

```bash
riqor plugin status --json
```

Reinstall it:

```bash
riqor plugin uninstall
riqor plugin install
riqor plugin status --json
```

Then rerun:

```bash
riqor doctor --json
```

## Shell Integration Is Missing

Inspect managed shell files:

```bash
riqor shell status --json
```

Reinstall the integration:

```bash
riqor shell uninstall
riqor shell install
```

Open a new terminal after the installer finishes.

## `verification-pending` Does Not Clear

Check the current state:

```bash
riqor terminal status --json
```

A successful recognized verification command clears pending evidence. Common recognized forms include:

```bash
bun test
npm test
pnpm test
yarn test
pytest
python -m pytest
cargo test
go test
dotnet test
mvn test
gradle test
swift test
git diff --check
codex doctor
kaku doctor
```

Scripts containing names such as `test`, `check`, `build`, `lint`, `typecheck`, or `validate` are also recognized for common JavaScript package managers.

A custom verification command that does not match the current classifier may succeed without clearing the state. Run a recognized relevant check or open an issue proposing a narrowly scoped classifier addition with tests.

## Activator Timing Flags Are Rejected

Timing flags require explicit activation:

```bash
riqor codex --activator \
  --activator-interval 15m \
  --activator-watchdog 3m
```

This is invalid:

```bash
riqor codex --activator-interval 15m
```

Check the limits:

| Option | Minimum | Maximum |
| --- | ---: | ---: |
| Interval | `1m` | `24h` |
| Watchdog | `10s` | `30m` |

Accepted suffixes are `ms`, `s`, `m`, and `h`.

## The Activator Does Not Checkpoint Immediately

The interval makes a checkpoint eligible. Riqor then waits for the next safe Codex `Stop` event. It does not interrupt an active turn.

Confirm the session was started through Riqor with explicit activation:

```bash
riqor codex --activator
```

The activator does not attach to a Codex process that was started separately.

## The Watchdog Did Not Stop Codex

This is expected. The activator watchdog limits one checkpoint review phase and prevents a repeated Stop loop. It is not a general Codex process timeout and does not kill the child process.

Terminate the Codex process through the normal terminal controls when required.

## Activator State Appears Stale

Closing a managed Codex session should trigger lifecycle cleanup. Activator state also uses stale pruning.

Do not manually edit state while a managed session is active. When investigating after all sessions are closed, inspect the configured plugin data directory and preserve a copy before removal.

Avoid replacing state paths with symlinks. The activator rejects symlink state and plugin data roots.

## Uninstall Did Not Remove the Command

Check which executable is being resolved:

```bash
type -a riqor
command -v riqor
```

You may have both an npm cache invocation and an installed shim, or more than one shim on `PATH`.

Run:

```bash
riqor uninstall
hash -r 2>/dev/null || true
```

Then inspect:

```bash
ls -la ~/.local/bin/riqor ~/.local/bin/codex-harness ~/.local/bin/cxh 2>/dev/null || true
```

## Repository Tests Fail

Use the same core sequence as CI:

```bash
bun install --frozen-lockfile
bun test
bun run plugin:health
bun run skills:health
bun run riqor:pack
bun run riqor:inspect -- packages/riqor/riqor-*.tgz
bun run riqor:test
bun run actions:verify
```

The CI environment uses Node.js 22, Bun 1.3.14, Ubuntu, and zsh.

## Open an Issue

For non-security problems, include:

- Riqor version
- operating system
- Node.js version
- Codex version when relevant
- exact command
- exit status
- redacted `riqor doctor --json` output
- smallest reproduction
- expected and observed behavior

For suspected vulnerabilities, use [GitHub Private Vulnerability Reporting](https://github.com/imMamdouhaboammar/riqor/security/advisories/new) instead of a public issue.
