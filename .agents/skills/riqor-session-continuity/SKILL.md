---
name: riqor-session-continuity
description: Use when managing agent session context, tracking task intent, recovering state across context resets, or writing handoff notes in Riqor.
---

# Riqor Session Continuity

## Core Rule
Maintain structured cognitive state across context resets, agent restarts, and session boundaries.

## Key Capabilities

1. **Session Activator**:
   Launch Codex or AGY with an activator to review progress at safe intervals:
   ```bash
   riqor codex --activator --activator-interval 15m
   riqor agy --activator --activator-interval 15m
   ```

2. **State Inspection**:
   Inspect active session parameters:
   ```bash
   riqor status --json
   ```

3. **Checkpoint Verification**:
   During a managed Stop checkpoint:
   - Restate primary goal and observable success criteria.
   - Inspect git status and modified files.
   - Record completed milestones in session memory.
   - Identify drift or unverified assumptions.
