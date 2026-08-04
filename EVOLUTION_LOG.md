# Evolution Log

## 0.0.1 Existing Codex Fierce baseline

- Narrow evidence-first hooks existed before this project
- Local hook tests passed
- It did not provide a benchmark harness, task paths, independent graders, or proven rollback

## 0.1.0 Baseline harness

- Added eight synthetic task classes
- Added deterministic graders and reference subjects
- Derived verdicts from process and check exits
- Captured bounded JSON, Markdown, and TOON evidence

## 0.2.0 Task-scoped capability capsule

- Replaced eager candidate capability loading with an owner-only temporary Codex home
- Linked only selected task skills
- Removed unrelated plugin and MCP startup from candidate mode
- Passed the recorded unseen holdouts with candidate-only rollback evidence

## 0.2.1 Evaluator and security hardening

- Missing usage became `null` rather than zero
- Timeout became exit 124
- Auth input became owner-only regular-file required
- Capability names reject path traversal
- Run repositories are removed in `finally`
- macOS repositories under OS temporary storage are rejected because sibling-write isolation is not reliable there
- Grader and holdout tests moved into repository `work` storage where the Codex sandbox boundary is effective

## 0.3.0 Installable Codex plugin

- Added valid plugin manifest and repo-local marketplace
- Added six lifecycle hook events
- Added deterministic routing with no prompt retention
- Added anonymous mutation and verification state
- Added one-time completion evidence reminder
- Added validator, health, package, smoke, install, and uninstall scripts
- Removed the overlapping `codex-fierce` active installation while retaining its rollback command

## 0.4.0 State and package review fixes

- Added per-turn exclusive lock for state read-modify-write operations
- Added bounded lock wait and fail-open behavior
- Removed ownership-unsafe stale-lock deletion
- Added independent stale-state and file-cap pruning tests
- Added Python 3.7 requirement for ZIP compression level support
- Added executable ZIP mode for future shell entry points

## 0.5.0 Curated skills and harness paths

- Discovered 59 skills from the requested skills pack
- Installed a reviewed subset from primary GitHub sources after the pack endpoint returned HTTP 429
- Removed the raw `agent-kernel` root skill after it copied 687 files and 4.1 MB into the project
- Retained nine locked project skills totaling 34 files and about 236 KB
- Added eight frozen harness paths with evidence, guardrails, and explicit approval lists
- Added privacy, performance, and evolution task profiles
- Added path-aware candidate capsules
- Added `harnessPath` to candidate holdout evidence and final comparison rows
- Added three plugin skills including `harness-paths`
- Installed plugin version `0.1.0+codex.20260804080901`

## 0.6.0 Universal session integration

- Added `codex-harness` and `cxh` with status, doctor, path, plugin, shell, terminal, and Codex passthrough commands
- Added bounded terminal evidence state without raw command or output retention
- Added silent `.zshenv` bootstrap and Kaku preexec and precmd hooks
- Repaired the Kaku interactive early-return bug and managed-bin PATH warning
- Added Kaku command filtering and zsh completion
- Verified the plugin through Codex CLI and the Codex binary bundled with ChatGPT
- Added reproducible curated-skill reconstruction from pinned revisions with transactional rollback
- Hardened reviewed skills from the final CodeRabbit findings
- Installed plugin version `0.2.0+codex.20260804101214`
