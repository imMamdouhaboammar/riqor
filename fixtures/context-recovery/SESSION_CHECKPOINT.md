# Checkpoint

- Verified: `LedgerEntry` and `Reconciliation` are the public contract and must not be renamed.
- Verified: input order is not meaningful and input must not be mutated.
- Remaining: implement `reconcile`.
- Rule: combine entries by account; `expectedCents` is the sum of expected values, `actualCents` the sum of actual values, and output is sorted by account.
- Required edge cases: empty input, repeated accounts, negative adjustments.
- Required check: `bun test`.
