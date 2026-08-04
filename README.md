# Codex Self-Improvement Harness

An evidence harness for measuring one bounded Codex control-plane change: task-scoped capability loading. It does not modify the model and does not claim AGI or parity with Claude Fable/Mythos.

## Run it

From this directory:

```bash
bun run test
bun run baseline
bun run compare
```

`baseline` reruns the eight required task classes in the current control environment. `compare` runs three separate holdouts first through the control and then through the candidate capsule. Both commands overwrite their corresponding JSON and Markdown reports only after the run completes.

## Evidence

- `CAPABILITIES.md`: installed/configured/proven capability audit.
- `BASELINE.md` and `baseline-results.json`: frozen control evidence.
- `ARCHITECTURE.md`: component map, safety boundary, and acceptance gate.
- `EVOLUTION_LOG.md`: rejected attempts, evaluator repairs, and accepted version.
- `FINAL_EVALUATION.md` and `final-results.json`: before/after holdout evidence.
- `*.toon`: lossless compact encodings of the repeated JSON results.

Synthetic repositories are deleted after each command. Reports retain only scenario identifiers, derived check results, usage/time/error metrics, and environment digests; they do not retain prompts, raw tool events, commands, stderr, or credential contents.

## Disable and rollback

The candidate is active only inside `compare` when a temporary `CODEX_HOME` is created. To disable it, do not run candidate mode; `bun run baseline` remains the unchanged control path. Every candidate capsule is removed in `finally`.

The recorded comparison proves candidate-only rollback by matching config and plugin digests immediately before and after candidate execution and by confirming no additional temporary capsule remained. No global Codex config, plugin, hook, MCP, skill, or memory file was changed.

## Known ceiling

The classifier is deliberately deterministic and covers four profiles. Add a profile only after a failed scenario proves the need. The current evidence covers eight baseline scenarios and three holdouts, not open-world task performance.
