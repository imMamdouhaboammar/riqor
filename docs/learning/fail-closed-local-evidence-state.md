# Fail-Closed Local Evidence State

Riqor's local state is not merely a cache when it decides whether verification is still required. It is part of the evidence boundary.

## The reliability rule

A missing state record can mean a session has never recorded evidence. An existing record that cannot be parsed or validated means something different: Riqor has lost certainty about what happened before the read.

For a completion gate, uncertainty must not become permission. The safe recovery rule is therefore:

```text
missing record -> clean initial state
existing invalid record -> verification pending
fresh successful verification -> gate may clear
```

This distinction prevents corruption, partial writes, or incompatible local data from silently turning a pending gate into a verified state.

## Atomicity is necessary but not sufficient

Writing a replacement file through a unique temporary file and atomic rename avoids exposing partially written JSON. The temporary name must also be collision-resistant when multiple processes share a state directory, and creation should be exclusive so an existing temp path is never silently reused.

Serialization protects the larger read-modify-write transaction. Without it, two individually atomic writes can still race after reading the same old state and one transition can overwrite the other.

## Filesystem paths are trust boundaries

State files can be attacker-controlled on a shared or compromised filesystem. Code that reads or replaces them should reject symbolic links and unexpected file types instead of following them implicitly. This does not remove every filesystem race, but it narrows the supported state shape and avoids treating arbitrary paths as trusted evidence storage.

## Why this belongs in Riqor

The product invariant is about fresh evidence after meaningful mutation. Persistence failures must therefore degrade toward requiring verification, not toward allowing completion. Recovery behavior is part of evidence integrity, not just storage hygiene.
