# Codex Session Activator Design

Riqor will add an event-driven activator for Codex sessions launched through `riqor codex` only.

At the next safe `Stop` event after a configured interval, the existing Riqor hook blocks completion once and instructs Codex to restore the task goal from the conversation, review completed work and repository evidence, identify drift or unsupported claims, correct the plan, and continue with the smallest relevant action.

The selected design uses lifecycle hooks rather than terminal input injection, concurrent `codex exec resume`, or a persistent daemon. This waits until Codex is idle, avoids two writers to one session, preserves TTY behavior and approval policy, and ends with the managed process.

## CLI

```text
riqor codex --activator [--activator-interval <duration>] [--activator-watchdog <duration>] [codex arguments...]
```

Defaults are `15m` for the interval and `3m` for the watchdog. Accepted suffixes are `ms`, `s`, `m`, and `h`. Interval bounds are `1m` to `24h`; watchdog bounds are `10s` to `30m`. Invalid values exit with status `64`. Riqor flags are removed before the remaining argument array is passed to Codex.

The wrapper creates a random session token and exports bounded activator environment values. The hook ignores activator behavior unless every value is valid. The token is hashed before use as a state key. Prompt text, transcript text, source contents, commands, and credentials are not retained.

## Lifecycle

`SessionStart` initializes state. `UserPromptSubmit` and `PostToolUse` update activity. The existing evidence gate runs first at `Stop`. When the interval is due, the activator enters a `reviewing` phase and emits one blocking checkpoint instruction. The next `Stop` completes the cycle and schedules the next interval. If the review phase exceeds the watchdog deadline, Riqor fails open, resets the cycle, and emits a bounded timeout message rather than blocking again. `SessionEnd` removes the activator record.

State lives under `PLUGIN_DATA/activator/`, uses restrictive permissions, atomic writes, hashed filenames, per-session locks, malformed and symlink rejection, and 24-hour stale pruning.

## Checkpoint contract

Codex must restate the current task and observable success criteria from the current conversation, inspect relevant status, diff, tests, and recent results, summarize only completed work, identify scope drift, repeated work, stale assumptions, missing checks, and unsupported completion claims, then correct the plan and continue. It must preserve the current approval policy and must not introduce destructive actions merely because the checkpoint ran.

## Watchdog

The watchdog bounds one activator checkpoint cycle and prevents repeated forced-review loops. It is not a general Codex process killer. The existing hook command timeout remains the hard execution bound for local hook code.

## Tests

Coverage includes duration parsing, flag removal, environment generation, initialization, activity updates, not-due behavior, one due block, successful cycle rescheduling, watchdog expiry, session isolation, malformed and symlink state rejection, cleanup, evidence-gate precedence, and packaged command routing.
