# Verify Generated Artifacts Before Regeneration

## Problem

Riqor commits its packaged runtime and a provenance manifest containing the size
and SHA-256 digest of every runtime file. The committed payload drifted from that
manifest, but CI rebuilt the runtime before checking it.

## Incorrect assumption

A successful check after regeneration proves that the repository contained valid
generated artifacts at checkout time.

It proves only that the generator can produce a self-consistent result. The build
has already destroyed the evidence needed to assess the committed state.

## Engineering concept

Validate immutable input before running a mutating repair step. A generated-artifact
pipeline needs two distinct checks:

1. a read-only check of what was committed; and
2. a build/test check of what can be generated now.

Their ordering is part of the integrity boundary.

## What Riqor now does

`riqor:runtime:verify` reads the committed package version, runtime payload, and
provenance manifest without writing files. CI runs it before installing the optional
shell dependency and before `riqor:build`. A mismatch therefore fails visibly instead
of being overwritten by regeneration.

The check shares `verifyPayloadProvenance` with `riqor doctor`, so installed-package
and repository validation enforce the same path, digest, size, and exact-file-set
rules.

Generated specialist reference files preserve their canonical source bytes. Their
runtime-copy path has a narrowly scoped Git whitespace attribute so repository diff
checks do not reinterpret intentional Markdown hard breaks or example conflict
markers as defects in the packaging change; all other runtime paths retain normal
whitespace checking.

## Failure case

Changing a runtime file while leaving `provenance.json` unchanged returns a nonzero
status with the first mismatched path. The build is not allowed to repair that drift
before CI records the failure.

## Test proving behavior

`test/riqor-committed-runtime.test.ts` proves that the gate accepts an intact fixture
without modifying its manifest and rejects a tampered payload. The CI step applies
the same gate to the actual committed `packages/riqor/runtime` tree.
