# Tutorial: Your First Evidence Loop & Managed Run

**What you'll build**: A repository-scoped run bound to a goal, tracking real workspace mutations, observing pending evidence states, and clearing verification before completing the run.

**What you'll learn**:
- How to initialize a repository run with `riqor run start`
- How workspace mutations trigger `verification-pending` state
- How running recognized test suites automatically transitions state back to `clear`
- How to inspect trace logs and complete a verified run

**Prerequisites**:
- [ ] Riqor installed (`npx riqor install`)
- [ ] A Git repository directory with a test runner (e.g. `bun test`, `npm test`, or `pytest`)

---

## Step 1: Start a Repository Run

A **Run** binds your goal, execution path, and profile to the current repository identity.

Initialize a new run:

```bash
riqor run start \
  --goal "Add input validation for user configuration" \
  --path evidence-loop \
  --profile assured
```

Inspect the active run status:

```bash
riqor run status --json
```

You should see output similar to:

```json
{
  "status": "active",
  "goal": "Add input validation for user configuration",
  "path": "evidence-loop",
  "profile": "assured",
  "evidencePending": false
}
```

---

## Step 2: Simulate a Workspace Mutation

When a command modifies files in your codebase, Riqor's shell integration detects the change and marks the state as `verification-pending`.

Simulate a modification (e.g., editing or creating a file):

```bash
touch src/config-validator.ts
```

Check the terminal state:

```bash
riqor terminal status
```

Output:

```text
verification-pending
```

> **Key Concept**: When evidence is pending, Riqor prevents `riqor run complete` from closing the run, ensuring no completion claims are accepted without empirical evidence.

---

## Step 3: Run Verification to Clear Evidence

Execute your project's test runner or a recognized verification command:

```bash
bun test
```

*(Or `npm test`, `pytest`, `cargo test`, `go test` depending on your stack).*

After a successful test run, inspect the terminal state again:

```bash
riqor terminal status
```

Output:

```text
clear
```

The evidence gate has recognized the passing test suite and transitioned the state from `verification-pending` back to `clear`.

---

## Step 4: Inspect the Trace Log

Riqor records an append-only JSON Lines trace log for every run. View the ordered sequence of events:

```bash
riqor trace show active
```

Or export the raw JSON Lines log:

```bash
riqor trace export active --format jsonl
```

Notice that trace logs store event types (`run_started`, `workspace_mutated`, `verification_required`, `verification_completed`), exit codes, and SHA-256 digests — without logging raw source code or sensitive secrets.

---

## Step 5: Complete the Verified Run

With verification `clear`, finalize and complete the run:

```bash
riqor run complete
```

Output:

```text
[riqor] Run completed successfully. Active run pointer cleared.
```

If you attempt to run `riqor run complete` while verification is pending, Riqor will reject the request with a non-zero exit code:

```text
Error: Cannot complete run while verification is pending. Run relevant tests first.
```

---

## What You Accomplished

You executed a full **Riqor Evidence Loop**:
1. **Goal Binding**: Created an explicit run bound to a goal.
2. **Mutation Tracking**: Observed automatic detection of workspace edits.
3. **Verification Gate**: Cleared pending evidence by executing a valid test suite.
4. **Audit Trail**: Reviewed the append-only trace log and safely completed the run.

---

## Next Steps

- 🛠️ Learn how to configure test classifiers in [Configure Evidence Gates](../how-to/configure-evidence-gates.md).
- 💡 Read the theory behind evidence-based completion claims in [Evidence Gate Lifecycle](../explanation/evidence-gate-lifecycle.md).
