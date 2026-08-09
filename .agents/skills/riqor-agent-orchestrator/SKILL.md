---
name: riqor-agent-orchestrator
description: Use when orchestrating autonomous agent goal loops, loopy convergence loops, or multi-agent verification pipelines in Riqor.
---

# Riqor Agent Orchestrator

## Core Rule
Execute goal-driven agent iterations with loopy convergence checks. Iterations must continue until all milestone criteria exit with empirical PASS.

## Key Capabilities

1. **Goal Initialization**:
   Define goal parameters with clear target metrics and bounds.

2. **Convergence Evaluation**:
   Evaluate progress at each iteration against target milestones. Stop when converged or when max iterations are reached with explicit diagnostic reporting.

3. **Deliberation Gate**:
   Synthesize multi-check deliberation votes to prevent false approvals and verify unslop code quality.
