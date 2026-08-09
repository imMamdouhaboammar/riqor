---
name: riqor-verification-gate
description: Use when completing tasks, making changes, or claiming work is done in any codebase monitored by Riqor to enforce empirical verification before completion.
---

# Riqor Verification Gate

## Core Rule
Never claim a task is resolved, fixed, or passing based on code edits alone. Empirical runtime evidence is required before any completion claim.

## Execution Flow

1. **Check Session Status**:
   ```bash
   riqor terminal status
   ```
   If status is `verification-pending`, a workspace mutation was performed and MUST be verified before finishing.

2. **Execute Targeted Verification**:
   - Run relevant test suites: `bun test`, `npm test`, or specific test files.
   - Run type checking: `tsc --noEmit` or build scripts.
   - Check status & logs: verify exit code 0.

3. **Verify Health**:
   ```bash
   riqor doctor --json
   ```

4. **Claim Completion**:
   Only state completion after all verification steps exit cleanly with zero errors.
