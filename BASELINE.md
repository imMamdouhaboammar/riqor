# Baseline Evaluation

Run: `baseline-2026-08-04T05-56-18-730Z`  
Started: 2026-08-04T05:56:18.730Z  
Codex: codex-cli 0.145.0  
Model: `gpt-5.6-sol`  
Objective digest: `7dc3348cd80182cf42d644664cd2ef1513fe06b49316a8e69cfda04fda7285a3`  
Configuration digest: `6eb44c837dec8b5749a6b4f90c38d6e17906712fbabbd6bf44a343799fc92f44`  
Plugin inventory digest: `092bf468e169fb0a2f95f5f3d38c77f8bca8a854d613f3aed33718766fb9556e`

## Outcome

- Correct completion: **0 / 8** (0.0%)
- Derived checks: **3 / 14** (21.4%)
- Tool-selection accuracy: **0.0%**
- Held-out test quality proxy: **0.0%**
- Human interventions required: **8**
- Total elapsed agent time: **0.9 seconds**
- Total input plus output tokens: **0**
- Structured event errors: **0**

## Scenarios

| Scenario | Verdict | Checks | Tool selection | Seconds | Tokens | Intervention |
|---|---:|---:|---:|---:|---:|---:|
| long-multistage | FAIL | 0/2 | 0.0% | 0.2 | unavailable | 1 |
| unfamiliar-repo | FAIL | 0/2 | 0.0% | 0.1 | unavailable | 1 |
| unclear-bug | FAIL | 1/2 | 0.0% | 0.1 | unavailable | 1 |
| cross-project | FAIL | 1/2 | 0.0% | 0.1 | unavailable | 1 |
| implicit-discovery | FAIL | 0/1 | 0.0% | 0.1 | unavailable | 1 |
| context-recovery | FAIL | 0/2 | 0.0% | 0.1 | unavailable | 1 |
| agent-review | FAIL | 1/2 | 0.0% | 0.1 | unavailable | 1 |
| unsupported-completion | FAIL | 0/1 | 0.0% | 0.1 | unavailable | 1 |

## Measurement rules

- Verdicts are derived from the Codex process exit and scenario check exits; the agent cannot submit its own pass flag.
- The held-out check rate is the current test-quality proxy. It measures unseen behavioral assertions, not line coverage.
- Human intervention is counted when the Codex process fails to complete non-interactively.
- Token totals are reported only from Codex's structured usage event.
- This baseline is scoped to this versioned scenario set and the three recorded digests. It is not a claim of parity with any external model.
