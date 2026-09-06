# Uncertainty Is Evidence

## Problem

The plugin treated an unreadable current-turn record like no record. Corruption or lock contention could therefore erase the fact that verification might still be required.

## Incorrect assumption

“Cannot load state” and “state does not exist” are not equivalent at a completion boundary.

## Engineering concept

A safety gate should fail closed on epistemic uncertainty. Existing untrusted state is evidence that prior history cannot be reconstructed, so the smallest safe recovery is a canonical pending state containing no untrusted fields.

## What Riqor now does

Missing turn state remains clean. Existing malformed, oversized, schema-invalid, symbolic-link, or non-regular state becomes an `unknown` pending mutation. Stop-time access failure blocks. A later recognized verification that actually completes with exit code zero can replace the conservative state and clear the gate.

## Failure case

```text
mutation observed
-> turn state is corrupted or locked
-> agent attempts Stop
-> completion stays blocked
-> fresh verification succeeds
-> completion may proceed
```

## Test proving behavior

`test/plugin-state.test.ts` covers corrupt and unsafe records plus recovery. `test/plugin-hooks.test.ts` covers pruning and live-lock failures at the actual Stop boundary.
