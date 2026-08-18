# Verification Provenance at Completion

## Scenario

A run observes a repository mutation and becomes `verification-pending`.

A later successful verification can make the run active again, but completion is only trustworthy if that successful verification is real evidence for the repository state being completed.

## Incorrect Assumption

A mutable lifecycle status such as `active` is equivalent to proof.

It is not. Status is a derived convenience; evidence is the ordered trace that explains why the status is valid.

Before this change, `run complete` primarily checked whether the run was `active`. A direct transition back to `active` could therefore substitute state for a verification event. Likewise, verification could be recorded when repository inspection was unavailable, or the repository could move to another `HEAD` afterward.

## Engineering Concept

**Evidence provenance** answers where a proof came from and what state it covered.

For Riqor, a completion decision after mutation needs to establish at least:

```text
latest relevant mutation
< successful verification
< completion
```

and verify that the repository identity captured by verification still matches the repository identity presented at completion.

This is stronger than `test passed = true` because the proof is tied to an ordered mutation boundary and repository state.

## Implementation

The completion gate now reads the persisted trace when the run has observed a mutation. It requires:

1. a successful `verification_completed` event after the latest mutation boundary;
2. usable verification repository provenance;
3. verification `HEAD` equal to current `HEAD`;
4. verification dirty-state equal to current dirty-state.

No persisted schema or dependency was added. Runs with no observed mutation keep the existing completion behavior.

## Test

The change was developed test-first. The test-only commit demonstrated three failures while the existing suite remained green:

- manually changing status to `active` did not provide verification evidence;
- repository inspection unavailable during verification did not provide usable provenance;
- changing `HEAD` after verification made the proof stale.

A matching verification/repository identity case remained valid.

## Failure Case Still Open

A boolean dirty flag is intentionally coarse. If the working tree is dirty during verification and then changes to a different dirty state while `HEAD` stays the same, `HEAD + dirty` cannot distinguish those states.

The next stronger step is a privacy-preserving working-tree fingerprint or equivalent repository-state digest, introduced only with clear semantics and adversarial tests.

## Lesson

Persisted lifecycle state should not self-certify correctness. When a decision matters, derive or validate it from durable evidence close to the decision boundary.
