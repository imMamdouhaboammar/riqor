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
- Product documentation says pending evidence prevents completion. The plugin's former one-reminder fail-open path was removed on 2026-08-21.
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

The plugin and terminal paths still classify commands independently in places, and filesystem changes outside observed tools can be missed. Assured completion now requires current verification evidence and repository identity, but dirty-to-dirty workspace changes remain weaker than a content fingerprint.

## Revalidation — 2026-08-19

Repository baseline: `8ae5f88186faa215abe3670a730b7b893c35f576` (`main`, version `0.2.6`).

Fresh inspection found that 317 of the 348 committed runtime provenance records
failed integrity or file-set validation after PR #12 merged. CI did not expose the
defect because it ran `riqor:build` before package tests, replacing the checked-in
runtime and provenance with newly generated files. The final `main` CI run also
ended before tests after the zsh installation step stalled, so the merge commit had
no completed package verification evidence.

Scores use the same baseline formula: `Fit + Reliability + User value + Repository
evidence + Testability + Learning + Confidence - Maintenance cost - Regression risk`.

| Rank | Candidate | Fit | Rel. | User | Evid. | Test | Learn | Conf. | Cost | Risk | Priority |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Verify committed runtime provenance before regeneration and repair the payload | 10 | 10 | 9 | 10 | 10 | 8 | 10 | 3 | 2 | 62 |
| 2 | Keep the plugin Stop evidence gate closed until fresh verification | 10 | 10 | 10 | 10 | 10 | 8 | 8 | 4 | 7 | 55 |
| 3 | Add privacy-preserving dirty-to-dirty workspace fingerprints | 10 | 10 | 9 | 10 | 9 | 9 | 6 | 8 | 8 | 47 |
| 4 | Harden terminal-state locking, symlinks, and temporary-file uniqueness | 8 | 9 | 8 | 10 | 9 | 8 | 8 | 6 | 5 | 49 |
| 5 | Bound and retry CI system-package installation | 6 | 8 | 7 | 10 | 6 | 5 | 9 | 2 | 2 | 47 |
| 6 | Restore complete `0.2.6` GitHub release evidence without republishing | 7 | 8 | 9 | 10 | 7 | 8 | 6 | 7 | 6 | 42 |

Candidate 1 was selected because it repairs a measured distribution-integrity
failure and prevents the exact CI ordering mistake from recurring. The new gate is
read-only, runs before both the zsh dependency step and runtime build, and fails
closed on manifest, digest, size, path, or file-set mismatch. It reuses the same
provenance verifier as the installed-package doctor rather than creating a second
integrity policy.

## Revalidation: 2026-08-21

Repository baseline: `8ae5f88186faa215abe3670a730b7b893c35f576` (`main`, version `0.2.6`)

The daily audit rescored seven bounded opportunities using the same formula as the initial baseline.

| Rank | Candidate | Fit | Rel. | User | Evid. | Test | Learn | Conf. | Cost | Risk | Priority |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Persist the plugin evidence gate until fresh verification | 10 | 10 | 10 | 10 | 10 | 8 | 9 | 3 | 5 | 59 |
| 2 | Add a read-only committed-runtime provenance gate | 8 | 9 | 8 | 10 | 10 | 8 | 8 | 4 | 4 | 53 |
| 3 | Correct unsigned-provenance trust terminology | 7 | 6 | 8 | 10 | 8 | 6 | 9 | 2 | 2 | 50 |
| 4 | Implement or remove the documented `trace show active` alias | 6 | 5 | 7 | 10 | 10 | 5 | 10 | 2 | 2 | 49 |
| 5 | Bind assured completion to a worktree content fingerprint | 10 | 10 | 10 | 9 | 8 | 9 | 6 | 7 | 8 | 47 |
| 6 | Observe failed tool events as conservative mutation boundaries | 10 | 9 | 9 | 7 | 8 | 8 | 6 | 6 | 7 | 44 |
| 7 | Consolidate terminal and plugin command classifiers | 9 | 8 | 7 | 9 | 9 | 7 | 7 | 7 | 6 | 43 |

Candidate 1 was selected because executable tests proved that a second ordinary `Stop` deleted pending mutation state and allowed an unsupported completion claim. The accepted contract is:

1. Every ordinary `Stop` remains blocked while relevant verification is pending.
2. An active-continuation `Stop` remains subject to the evidence gate and skips only recursive activator work.
3. Only a recognized structured-zero check with sufficient scope clears the gate; help and version modes are not checks.
4. The activator remains downstream of the evidence decision.
5. `SessionEnd` remains the explicit cleanup boundary.
