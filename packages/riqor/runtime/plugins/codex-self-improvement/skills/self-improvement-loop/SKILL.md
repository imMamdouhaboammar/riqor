---
name: self-improvement-loop
description: Use when improving Codex workflows, prompts, hooks, skills, plugins, or agent controls and the change must be measured against a baseline, unseen holdouts, regression checks, and rollback criteria
---

# Self Improvement Loop

Treat self improvement as a controlled software change around the model

1. State the observable capability gap and the evidence that it occurred
2. Freeze a reproducible baseline before changing prompts, hooks, skills, plugins, memory, or configuration
3. Form one causal hypothesis and make one bounded intervention
4. Keep tasks, graders, model, permissions, timeout, and environment stable between control and candidate runs
5. Use unseen holdouts that were not used while creating the intervention
6. Reject any candidate with a correctness, safety, privacy, or rollback regression
7. Record time, tokens, structured errors, interventions, checks, and environment digests only when the runtime exposes them
8. Store no prompts, source contents, command outputs, credentials, or user-specific paths in evaluation reports
9. Accept the candidate only when the result is reproducible and the prior state can be restored
10. End with baseline evidence, candidate evidence, accepted or rejected verdict, limits of the claim, and rollback steps

Never claim model-weight changes, AGI, determinism, or parity with another model from a control-plane change
