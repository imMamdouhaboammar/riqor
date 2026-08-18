# Conservative Mutation Evidence

## Problem

A shell command can change a file and then fail: `write-file; failing-step`. Its final nonzero exit proves that the compound command failed, not that earlier side effects were rolled back.

## Incorrect assumption

Treating `exitCode !== 0` as “no mutation happened” leaves old verification looking fresh after a partial write.

## Engineering concept

Failure is not atomic rollback. At an observation boundary, uncertainty about side effects must invalidate evidence conservatively. Verification success has the opposite burden: it requires a recognized command, actual completion, and a zero exit.

## What Riqor now does

Every mutation-classified terminal command makes evidence pending, while retaining its real success or failure outcome in the trace. Package scripts count as verification only when a check word is an exact delimited name part, preventing unrelated names such as `contest` from clearing the gate.

## Test proving behavior

`test/terminal-runtime.test.ts` covers the local evidence transition, `test/assurance-terminal-trace.test.ts` covers active-run invalidation, and `test/plugin-hooks.test.ts` covers the unrelated-script bypass at the plugin boundary.
