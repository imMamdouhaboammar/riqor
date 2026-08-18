# Riqor Autonomous Engineering Baseline

Date: 2026-08-18  
Repository baseline: `f3ce876f6278b762ac8b759996748ff5a13d9feb` (`main`, version `0.2.6`)

This is a point-in-time engineering map, not a permanent roadmap. Code and fresh runtime evidence take precedence when this document drifts.

## Repository reality

- The published Node.js CLI enters through `packages/riqor/bin/riqor.mjs`; package commands live under `packages/riqor/src/`, while the broader harness and assured-run commands live under `src/`.
- Four related state machines coexist: shell-session evidence (`src/terminal-runtime.ts`), repository-scoped runs and traces (`src/assurance/`), plugin per-turn evidence (`plugins/riqor/hooks/state.ts`), and activator checkpoints (`plugins/riqor/hooks/activator.ts`).
- The Codex/Claude-style plugin routes prompts and handles `SessionStart`, `UserPromptSubmit`, `SubagentStart`, `PostToolUse`, `Stop`, and `SessionEnd` in `plugins/riqor/hooks/main.ts`.
- Mutation detection is command/tool classification, not a filesystem watcher. Shell preexec/postexec feeds terminal state; plugin file tools feed per-turn state. These paths do not share one evidence ledger.
- Terminal verification clears a boolean pending flag. Plugin verification is scope-aware (`code` or `docs`) and requires a structured zero exit. Assured runs persist ordered events and derive their lifecycle from the trace.
- Repository identity uses a normalized root digest plus Git head/dirty metadata. State is repository-scoped, but not every mutation source reaches the assured-run trace.
- Run persistence uses bounded schemas, atomic replacement, append-only event sequences, lock recovery, and reconciliation. Plugin state uses per-turn locks and bounded local records. Terminal state is simpler and has weaker validation/locking.
- The activator is optional, interval-driven, locally persisted, watchdog-bounded, and evaluated after the evidence gate at `Stop`.
- Traces retain bounded metadata and command digests rather than raw commands, prompts, output, or source code.
- Integrations include packaged CLI aliases, shell preexec/postexec hooks, a bundled plugin, managed Codex agents, MCP tools, and skill packs.
- Distribution is generated into `packages/riqor`, inspected as a tarball, and covered by install-without-Bun tests. Release `0.2.6` exists as a tag, but its release workflow failed the registry-byte comparison.
- Tests cover routing, plugin lifecycle/state/activator, terminal transitions, run-store recovery/corruption/concurrency, CLI, packaging, rollback, security, and release tooling. Cross-source mutation invalidation and completion proof remain weaker boundaries.
- Security controls include no-raw-command state, hashed identifiers, symlink checks in stronger stores/install paths, action pinning, bounded state, and local-first persistence. Terminal-state storage and installer ownership boundaries deserve additional adversarial work.
- Performance work is intentionally modest: bounded file counts, small records, digests, and repository-scoped lookups. No broad performance claim is supported by a benchmark suite.
- Linux is exercised in CI. macOS is documented/supported but lacks an equivalent CI lane; Windows is not claimed as supported.

## Documentation drift found

- `docs/reference/schema-and-state-reference.md` describes older run/event field names than `src/assurance/types.ts` persists.
- Product documentation says pending evidence prevents completion, while the plugin `Stop` path currently fails open after one reminder.
- `docs/reference/cli-reference.md` advertises `trace show active`, but the CLI treats `active` as a literal run id.
- Root architecture/version and backlog documents contain pre-`0.2.6` status, while package metadata is `0.2.6`.
- Release evidence is claimed broadly, but `0.2.6` lacks the checked-in verification JSON present for several earlier releases.

## Ranked opportunities

Scores are 1–10. `Priority = Fit + Reliability + User value + Repository evidence + Testability + Learning + Confidence - Maintenance cost - Regression risk`.

| Rank | Candidate | Fit | Rel. | User | Evid. | Test | Learn | Conf. | Cost | Risk | Priority |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Reject substring-named “checks” and keep failed mutation commands verification-pending | 10 | 10 | 9 | 10 | 10 | 8 | 10 | 2 | 2 | 63 |
| 2 | Require a successful verification event before assured-run completion | 10 | 10 | 10 | 10 | 9 | 9 | 7 | 6 | 7 | 52 |
| 3 | Harden terminal-state parsing, locking, symlink rejection, and temp-file uniqueness | 8 | 9 | 8 | 9 | 9 | 8 | 8 | 6 | 5 | 48 |
| 4 | Generate state/trace reference examples from runtime schemas | 7 | 6 | 8 | 10 | 9 | 6 | 9 | 4 | 3 | 48 |
| 5 | Bind completion to repository state captured by the latest verification | 10 | 10 | 10 | 9 | 8 | 9 | 6 | 7 | 8 | 47 |
| 6 | Consolidate all mutation and verification classification policy | 9 | 9 | 8 | 9 | 9 | 8 | 7 | 7 | 6 | 46 |
| 7 | Bridge plugin file mutations into the active repository run | 10 | 10 | 9 | 9 | 8 | 8 | 6 | 7 | 7 | 46 |
| 8 | Replace the plugin's one-reminder fail-open completion behavior | 10 | 10 | 9 | 10 | 8 | 7 | 6 | 6 | 9 | 45 |
| 9 | Replace mtime-only run-lock recovery with owner/token-aware leases | 8 | 9 | 7 | 8 | 8 | 9 | 7 | 6 | 6 | 44 |
| 10 | Add a macOS package/install verification lane | 7 | 7 | 8 | 8 | 8 | 7 | 8 | 5 | 4 | 44 |
| 11 | Add explicit orphaned-run discovery and recovery commands | 8 | 8 | 8 | 8 | 8 | 9 | 7 | 7 | 6 | 43 |
| 12 | Investigate the `0.2.6` registry tarball mismatch and restore complete release evidence | 7 | 8 | 9 | 10 | 7 | 8 | 6 | 7 | 6 | 42 |

Priority is a decision aid rather than an automatic roadmap. Candidate 1 was selected because it directly closes two executable evidence-integrity gaps with a small, compatibility-conscious change. Candidates 2–5 need explicit lifecycle design because they affect completion semantics or connect currently separate state owners. Open PR #11 already addresses fresh repository evidence, so overlapping implementation was avoided.

## Selected contract

1. A package script is verification only when `build`, `check`, `lint`, `test`, `typecheck`, or `validate` is an exact colon/dash/underscore-delimited name part.
2. Names that merely contain those strings, such as `contest` and `latest`, cannot clear pending evidence.
3. A mutation-shaped command keeps evidence pending even when its final exit code is nonzero, because earlier shell operations may already have changed the workspace.
4. The failure exit remains recorded; conservative invalidation does not relabel the command as successful.
5. Only a later recognized verification with a zero exit clears the terminal evidence state.

## Remaining architectural risks

The plugin and terminal paths still classify commands independently in places, filesystem changes outside observed tools can be missed, the plugin gate can fail open after one reminder, and assured completion does not yet require a minimum proof event. Repository identity freshness is being changed separately in PR #11 and should be re-audited after it lands.
