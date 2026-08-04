# Measured Self-Improvement Architecture

Version: 0.2.1  
Status: accepted on the recorded unseen holdouts

## Observable target

Preserve the baseline's 8/8 correct completion, 14/14 derived checks, zero interventions, and 100% held-out proxy while reducing the measured control-plane cost on unseen tasks:

- 2,290.5 aggregate agent-seconds;
- 8,798,273 input plus output tokens;
- 154 runtime/structured errors;
- skill descriptions removed after exceeding the 2% context budget;
- 78 additional skills omitted and twelve invalid duplicated skill definitions rejected.

No correctness-changing hook is justified by the baseline. The first candidate therefore changes only capability loading and execution isolation.

## Smallest architecture that covers the objective

| Required component | Implementation / reuse | Why it exists |
|---|---|---|
| Capability Registry | A small allowlist of already-installed, validated skill paths plus native Codex capabilities | Replaces enumeration of hundreds of definitions with task-scoped truth |
| Task Classifier | Deterministic prompt/file keyword rules with a default engineering profile | Selects a bounded profile without an extra model call |
| Discovery | Registry lookup that verifies selected paths before execution | Fails closed on a missing selected capability; never installs automatically |
| Preflight Hook | A runner lifecycle function that creates an owner-only temporary Codex home and project instruction | Removes irrelevant global skills, MCPs, plugins, and hooks for the candidate run |
| Execution Controller | Existing Bun runner plus native `codex exec`; model, sandbox, and scenario stay pinned | Keeps before/after conditions reproducible |
| Independent Verifier | Existing scenario graders, validated against broken and reference subjects | The candidate cannot self-award completion |
| Evidence Gate | Existing derived result contract using agent and check exit codes | Rejects prose-only success |
| Episodic Memory | Versioned run JSON/TOON, baseline/final reports, and `EVOLUTION_LOG.md` | Keeps bounded local evidence without modifying global user memory |
| Failure Learning | One explicit loop entry per observed gap, hypothesis, isolated change, and verdict | Prevents autonomous rule accumulation from one anecdote |
| Regression Suite | Forty-five harness, contract, grader, timeout, telemetry, and capsule tests | Guards the evaluator before evaluating Codex |
| Versioning / Rollback | Candidate profile version in evidence; temporary home deleted after each run; control command remains available | Disable is omission of candidate mode; no global recovery step is required |

## Candidate: task-scoped capability capsule

The candidate uses platform features already present:

1. Classify the task from its text.
2. Select zero to a few installed skills from the registry.
3. Create a temporary `CODEX_HOME` with mode 0700.
4. Link, rather than copy, the existing Codex authentication file; never print, hash, or persist its contents.
5. Write a minimal config with the same model, reasoning level, approval policy, and sandbox, but no unrelated MCP or plugin startup.
6. Link only the selected skill directories and write a compact evidence-first `AGENTS.md`.
7. Run the exact same task and grader.
8. Delete the temporary home in a `finally` block.
9. Delete synthetic run repositories after public evidence is written.

This is one isolated intervention: **replace eager global capability loading with task-scoped loading**. It does not change the model, task, fixture, grader, safety boundary, or pass criteria.

## Control and holdout design

- Create at least three unseen holdouts after the baseline is frozen: implementation, database design, and completion review.
- Run each holdout twice: current control and candidate capsule.
- Keep model, reasoning level, sandbox, task text, fixtures, check commands, concurrency, and timeout identical.
- Candidate success requires all holdout checks to pass, no critical harness regression, fewer runtime errors, and lower aggregate tokens and elapsed time.
- A correctness regression immediately rejects the candidate regardless of efficiency.

The baseline scenarios remain regression tests and are not used as holdouts. The candidate passed all three recorded unseen holdouts while the control passed two. The result is scoped to this harness; it is not a Claude Fable/Mythos or AGI parity claim.

## Safety and privacy boundaries

- No global config, skill, hook, plugin, MCP, or memory file is edited by the capsule.
- No credentials enter reports. Authentication is referenced only by a temporary filesystem link with owner-only parent permissions.
- User-facing results contain bounded identifiers, derived metrics, digests, and exit-based verdicts—not task text, repository paths, commands, stderr, or tool output.
- Missing auth, missing selected skill, invalid registry entry, or failed cleanup is an explicit candidate failure.

## Rollback

Rollback is architectural, not aspirational:

- The control path never invokes the capsule.
- Each candidate run deletes its temporary home after Codex exits, including failed runs.
- Disabling the candidate means running the unchanged `baseline`/`control` mode.
- A rollback test must prove the temporary home is gone and the global Codex config/plugin digests are unchanged.
