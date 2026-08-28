# Crash-Safe Mutation Intent

## Problem

A terminal command can change files and then terminate its shell before the normal completion callback runs. Recording mutation only after command completion leaves stale verification usable during that gap.

## Incorrect assumption

No `postexec` callback does not mean no side effect occurred. Exit callbacks report outcomes; they do not make shell commands transactional.

## Engineering concept

Persist the conservative safety transition before starting an operation with possible side effects. Completion may enrich the trace later, but it must not be the first durable evidence boundary.

## What Riqor now does

For a mutation-classified terminal command, `preexec` immediately marks terminal evidence pending and appends `verification_required` to the active assured run. A later zero-exit recognized verification is the only path that clears the gate.

## Failure case

```text
verification passes
→ mutation command starts
→ file changes
→ shell crashes before postexec
→ completion is attempted
```

Completion remains blocked because the mutation intent was durable before the command ran.

## Test proving behavior

The terminal runtime tests assert that mutation `preexec` is already pending. The assured CLI regression starts a run, records only mutation `preexec`, changes a tracked file, and verifies that completion is rejected without relying on `postexec`.
