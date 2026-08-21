# Persistent Completion Gates

## Problem

A completion gate blocked the first attempt after a mutation, then deleted its state and allowed the next attempt without new verification.

## Incorrect assumption

One reminder was treated as equivalent to satisfying the gate. A warning can influence an agent, but it is not evidence that verification completed successfully.

## Engineering concept

An authorization condition must remain level-triggered: while the unsafe condition exists, every independent decision observes it. Consuming the condition on first read turns a safety gate into an edge-triggered notification.

Active-continuation lifecycle callbacks are a separate concern. The host uses them to let the agent act on Stop-hook feedback. They must remain subject to a condition the agent can resolve, such as running verification; only unrelated recursive checkpoint behavior should be suppressed.

## What Riqor now does

An observed mutation remains pending across ordinary and active-continuation `Stop` events. A recognized, successful check with sufficient scope—or the explicit `SessionEnd` cleanup boundary—can clear it. Help and version modes do not count as execution, even when they return zero. The host still applies its documented eight-continuation safety cap.

## Failure case

```text
mutation -> Stop blocked -> Stop allowed without verification
```

The second transition was the defect. It is now blocked as long as the mutation remains unverified.

## Test proving behavior

`test/plugin-hooks.test.ts` exercises repeated ordinary Stops, an active continuation, and a later successful verification. `test/plugin-state.test.ts` proves repeated gate reads do not consume pending state.
