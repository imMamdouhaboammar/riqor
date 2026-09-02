# Successful discovery is not successful verification

## Problem

A code mutation made verification pending. Riqor then accepted
`pytest --collect-only` with exit 0 as a passing check and allowed Stop, even
though no test body ran. Go test listing and dotnet test discovery had the same
classification problem.

## Incorrect assumption

A test-runner command name and a successful exit prove that verification ran.
Exit status describes whether the requested operation succeeded; the requested
operation may only be discovery.

## Engineering concept

Evidence requires both operation semantics and a successful observed outcome.
Use the runner's contract, not a shared blacklist of short flags whose meanings
differ between tools. Preserve quoted argument boundaries so a selector or path
that contains mode-looking text is not mistaken for a command option.

## What Riqor does

The shared verification helper rejects explicit, recognized inspection-only
modes before either terminal or plugin code can issue verification evidence.
The existing pending-state and assured-run gates then remain in force. A later
ordinary, successful check can still clear them; no new state schema is needed.

## Regression proof

`test/nonexecuting-verification.test.ts` exercises command policy and the
mutation → inspection-only exit 0 → still pending lifecycle. Positive cases
protect normal checks and supported build evidence. The tests use synthetic
command outcomes to test Riqor's decision, not to claim external runners passed.

## Primary contracts and limits

- [pytest reference](https://docs.pytest.org/en/stable/reference/reference.html#command-line-flags): collection and setup planning do not execute tests;
  setup display does.
- [Go testing flags](https://pkg.go.dev/cmd/go#hdr-Testing_flags): listing reports
  matching names without executing tests.
- [dotnet test with VSTest](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-test-vstest): list-tests discovers tests instead of running them.

This does not inspect arbitrary script bodies, environment/configuration-driven
modes, or establish a nonzero test count. Those need separate evidence contracts.
