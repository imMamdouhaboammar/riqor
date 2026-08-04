# Evolution Log

## 0.0.1 — Existing Codex Fierce baseline

- Status: installed before this objective; measured as part of control.
- Evidence behavior: narrow post-mutation completion gate with six passing local tests.
- Boundary: not a self-improvement harness and not proof of long-horizon superiority.

## 0.1.0 — Baseline harness

- Observed gap: no reproducible measurement or independent pass derivation.
- Change: eight synthetic scenarios, deterministic graders, reference-oracle checks, bounded result schema, JSON plus TOON evidence.
- Validation: 30/30 harness tests; every grader rejects its broken fixture and accepts its reference behavior.
- Baseline: 8/8 scenarios and 14/14 checks passed with zero interventions.
- New measured gap: 2,290.5 agent-seconds, 8,798,273 tokens, 154 errors, skill context overflow, and MCP startup failures.

## 0.2.0 — Task-scoped capability capsule

- Hypothesis: eager loading of hundreds of skill definitions, 29 installed plugins, and 39 configured MCPs drives avoidable context and startup cost.
- Isolated change: use an owner-only temporary Codex home that exposes only task-selected installed skills and no unrelated MCP/plugin startup.
- Rejection rule: any holdout correctness regression, global digest drift, credential exposure, or failed cleanup.
- Evaluator repair 1: the first atomic-batch grader required an exception even though the task allowed whole-batch rejection. The grader was changed only after a failing oracle test proved the overfit.
- Evaluator repair 2: the first rollback snapshot included control-side global hook drift. Candidate rollback is now measured immediately before and after candidate execution.
- Evaluator repair 3: the webhook grader required one SQL spelling and the literal word “foreign.” Failing oracle tests widened it to equivalent table-level/inline references and semantic evidence language.
- Telemetry repair: a timed-out process could surface exit 0 and missing usage as zero tokens. Timeout is now exit 124, missing usage is `null`, and token comparison uses matched reported pairs only.
- Fresh holdout result: control 2/3, candidate 3/3; time -40.1%, matched-pair tokens -61.6%, errors -73.1%, interventions 1 to 0.
- Rollback evidence: candidate-before and candidate-after config/plugin digests matched and no temporary capsule remained.
- Status: **accepted** for this harness; no external-model or AGI claim.

## 0.2.1 — Final safety and evidence hardening

- Authentication input now fails closed unless it is an owner-only regular file.
- Capability names reject path separators before symlink creation.
- The capsule explicitly preserves Codex's default sensitive-environment exclusions.
- Synthetic run repositories are removed in `finally` after bounded public evidence is written.
- The final report names the matched-pair token rule instead of implying unavailable usage was zero.
- Validation: 45/45 tests and 104 assertions pass.
