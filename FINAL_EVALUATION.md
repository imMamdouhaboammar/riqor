# Final Evaluation

Run: `compare-2026-08-04T05-10-08-250Z`  
Started: 2026-08-04T05:10:08.250Z  
Candidate verdict: **ACCEPTED**  
Rollback verified: **yes**

## Before / after

| Holdout | Control | Candidate | Control seconds | Candidate seconds | Control tokens | Candidate tokens |
|---|---:|---:|---:|---:|---:|---:|
| atomic-batch | PASS | PASS | 541.9 | 261.8 | 2133808 | 735109 |
| webhook-schema | FAIL | PASS | 600.1 | 390.4 | unavailable | 1079778 |
| security-claim | PASS | PASS | 99.5 | 91.9 | 281713 | 191724 |

- Correct completion: 2/3 → 3/3
- Held-out test quality proxy: 100.0% → 100.0%
- Tool-selection accuracy: 83.3% → 100.0%
- Time reduction: **40.1%**
- Token reduction: **61.6%**
- Token reduction uses only matched holdout pairs where both runs reported structured usage; unavailable usage is excluded rather than treated as zero.
- Error reduction: **73.1%**
- Human interventions: 1 → 0

The candidate is accepted only if every unseen holdout passes, quality does not regress, both time and tokens fall, errors do not increase, and rollback leaves global Codex state unchanged. This evidence is scoped to this harness and is not an external-model parity claim.
