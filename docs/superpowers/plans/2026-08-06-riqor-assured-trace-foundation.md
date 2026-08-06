# Riqor Assured Trace Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add repository-scoped run records, privacy-bounded trace events, terminal evidence integration, and completion commands without changing existing Riqor installation or Codex behavior.

**Architecture:** A new `src/assurance/` package owns repository identity, run persistence, trace append, and CLI handlers. The existing terminal runtime remains the source of command classification and exposes a processed transition after `postexec`. `src/harness-cli.ts` delegates `run` and `trace` commands to the assurance CLI and forwards processed terminal transitions to the active run.

**Tech Stack:** TypeScript, Bun 1.3.14 tests and runtime, Node.js 22 package target, Node standard library only, JSON and JSONL local state, Git subprocesses with `shell: false`.

## Global Constraints

- No new runtime dependency
- Do not persist raw shell commands, command output, prompts, source content, environment values, credentials, cookies, or tokens
- State directories use mode `0700`; state files use mode `0600`
- Preserve the existing terminal state schema version and shell command syntax
- Preserve `riqor install`, `doctor`, `status`, `uninstall`, `codex`, and compatibility aliases
- All mutable JSON writes use temporary file plus atomic rename
- Every run mutation allocates its sequence under an exclusive per-run lock
- Run records belong to the current repository digest
- Failed mutations do not create fresh pending evidence
- A run cannot complete while verification is pending

---

### Task 1: Assurance contracts and repository identity

**Files:**
- Create: `src/assurance/types.ts`
- Create: `src/assurance/repository-identity.ts`
- Test: `test/assurance-repository-identity.test.ts`

**Interfaces:**
- Produces: `ExecutionProfileId`, `RiqorRunStatus`, `RiqorRun`, `RiqorTraceEvent`, `RepositoryIdentity`
- Produces: `inspectRepositoryIdentity(cwd: string): Promise<RepositoryIdentity>`
- Produces: `normalizeRunGoal(value: string): string`
- Produces: `resolveRiqorStateRoot(env?: NodeJS.ProcessEnv, home?: string): string`

- [ ] **Step 1: Write the failing contract and identity tests**

```ts
import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  inspectRepositoryIdentity,
  normalizeRunGoal,
  resolveRiqorStateRoot,
} from "../src/assurance/repository-identity";

describe("assurance repository identity", () => {
  test("normalizes and bounds explicit goals", () => {
    expect(normalizeRunGoal("  Add trace records\n")).toBe("Add trace records");
    expect(() => normalizeRunGoal("   ")).toThrow("goal is required");
    expect(() => normalizeRunGoal("x".repeat(2001))).toThrow("goal exceeds 2000 characters");
  });

  test("uses XDG state before the home fallback", () => {
    expect(resolveRiqorStateRoot({ XDG_STATE_HOME: "/tmp/state" } as NodeJS.ProcessEnv, "/home/u"))
      .toBe("/tmp/state/riqor");
    expect(resolveRiqorStateRoot({} as NodeJS.ProcessEnv, "/home/u"))
      .toBe("/home/u/.local/state/riqor");
  });

  test("records a digest and git metadata without exposing the root path", async () => {
    const root = await mkdtemp(join(tmpdir(), "riqor-identity-"));
    await Bun.$`git init -q ${root}`;
    await Bun.$`git -C ${root} config user.email test@example.com`;
    await Bun.$`git -C ${root} config user.name Test`;
    await writeFile(join(root, "README.md"), "fixture\n");
    await Bun.$`git -C ${root} add README.md`;
    await Bun.$`git -C ${root} commit -qm initial`;
    await mkdir(join(root, "nested"));

    const identity = await inspectRepositoryIdentity(join(root, "nested"));
    expect(identity.rootDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(identity.headSha).toMatch(/^[a-f0-9]{40}$/);
    expect(identity.dirty).toBe(false);
    expect(JSON.stringify(identity)).not.toContain(root);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
bun test test/assurance-repository-identity.test.ts
```

Expected: FAIL because `src/assurance/repository-identity.ts` does not exist.

- [ ] **Step 3: Implement the contracts**

`src/assurance/types.ts` defines exact schema version 1 types from the approved design. Metadata values are limited to `string | number | boolean | null`.

`src/assurance/repository-identity.ts` must:

```ts
export type RepositoryIdentity = Readonly<{
  rootDigest: string;
  headSha: string | null;
  dirty: boolean;
  rootPath: string;
}>;

export function normalizeRunGoal(value: string): string;
export function resolveRiqorStateRoot(env?: NodeJS.ProcessEnv, home?: string): string;
export async function inspectRepositoryIdentity(cwd: string): Promise<RepositoryIdentity>;
```

Implementation rules:

- Resolve Git root with `git -C <cwd> rev-parse --show-toplevel`
- Fall back to `realpath(cwd)` when outside Git
- Resolve HEAD with `git rev-parse HEAD`; use `null` when unavailable
- Resolve dirty state with `git status --porcelain --untracked-files=normal`
- Spawn Git with argument arrays and `shell: false`
- Keep `rootPath` in the in-memory result only; callers never serialize it
- Hash the canonical root with SHA-256

- [ ] **Step 4: Run the focused test and confirm pass**

```bash
bun test test/assurance-repository-identity.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the task**

```bash
git add src/assurance/types.ts src/assurance/repository-identity.ts test/assurance-repository-identity.test.ts
git commit -m "feat: add assurance run contracts"
```

### Task 2: Run store and append-only trace

**Files:**
- Create: `src/assurance/run-store.ts`
- Test: `test/assurance-run-store.test.ts`

**Interfaces:**
- Consumes: `RepositoryIdentity`, `RiqorRun`, `RiqorTraceEvent`
- Produces: `createRun(options): Promise<RiqorRun>`
- Produces: `readActiveRun(options): Promise<RiqorRun | null>`
- Produces: `readRun(options): Promise<RiqorRun>`
- Produces: `transitionRun(options): Promise<RiqorRun>`
- Produces: `appendRunEvent(options): Promise<RiqorTraceEvent>`
- Produces: `readRunEvents(options): Promise<RiqorTraceEvent[]>`
- Produces: `completeRun(options): Promise<RiqorRun>`

- [ ] **Step 1: Write failing run-store tests**

The tests create an isolated state root and repository fixture, then assert:

```ts
const run = await createRun({
  stateRoot,
  identity,
  goal: "Add trace records",
  pathId: "evidence-loop",
  profileId: "assured",
  now: new Date("2026-08-06T20:00:00.000Z"),
  randomId: () => "run-1",
});

expect(run.status).toBe("active");
expect(run.nextSequence).toBe(2);
expect(await readRunEvents({ stateRoot, identity, runId: run.runId })).toEqual([
  expect.objectContaining({ sequence: 1, type: "run_started" }),
]);
```

Additional cases:

- Starting a second active run fails
- `run.json`, `events.jsonl`, and `active.json` do not contain `identity.rootPath`
- Sequential appends produce sequences 2 and 3
- Unknown schema versions fail closed
- A stale lock older than 30 seconds is removed and recovered
- A live lock times out with `run state is busy`
- Completing a `verification-pending` run fails
- Completing an active run appends `run_completed` and removes `active.json`
- Explicit run IDs from another repository digest are rejected as missing

- [ ] **Step 2: Run the focused test and confirm failure**

```bash
bun test test/assurance-run-store.test.ts
```

Expected: FAIL because `src/assurance/run-store.ts` does not exist.

- [ ] **Step 3: Implement the store**

Use this state shape:

```text
<stateRoot>/projects/<rootDigest>/active.json
<stateRoot>/projects/<rootDigest>/runs/<runId>/run.json
<stateRoot>/projects/<rootDigest>/runs/<runId>/events.jsonl
<stateRoot>/projects/<rootDigest>/runs/<runId>/.lock
```

Required internal helpers:

```ts
async function writeJsonAtomic(path: string, value: unknown): Promise<void>;
async function withRunLock<T>(runDir: string, action: () => Promise<T>): Promise<T>;
function publicRepository(identity: RepositoryIdentity): RiqorRun["repository"];
```

Lock behavior:

- Acquire with `open(lockPath, "wx", 0o600)`
- Lock content contains `{ pid, createdAt }`
- Retry every 20 ms for at most 1,000 ms
- Remove a regular lock file older than 30,000 ms
- Reject a symlink lock or symlink target state file
- Always remove the owned lock in `finally`

Event append under the lock:

1. Read and validate `run.json`
2. Allocate `sequence = run.nextSequence`
3. Build the event with a fresh UUID
4. Append one JSON line using mode `0600`
5. Update `run.nextSequence = sequence + 1`
6. Apply any requested run status transition
7. Atomically replace `run.json`

- [ ] **Step 4: Run the focused test and confirm pass**

```bash
bun test test/assurance-run-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the task**

```bash
git add src/assurance/run-store.ts test/assurance-run-store.test.ts
git commit -m "feat: persist assured run traces"
```

### Task 3: Terminal transition evidence integration

**Files:**
- Modify: `src/terminal-runtime.ts`
- Create: `src/assurance/terminal-trace.ts`
- Modify: `src/harness-cli.ts`
- Modify: `test/terminal-runtime.test.ts`
- Test: `test/assurance-terminal-trace.test.ts`

**Interfaces:**
- Produces from terminal runtime: `TerminalPostexecTransition`
- Produces: `recordActiveRunTerminalTransition(options): Promise<RiqorRun | null>`

- [ ] **Step 1: Add failing terminal regression tests**

Add to `test/terminal-runtime.test.ts`:

```ts
test("a failed mutation does not create fresh pending evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "riqor-terminal-"));
  await recordTerminalPreexec(root, "s", "echo x > src/a.ts", 1000);
  const result = await recordTerminalPostexec(root, "s", 1, 1001);
  expect(result.evidencePending).toBe(false);
  expect(result.transition).toEqual(expect.objectContaining({
    kind: "mutation",
    exitCode: 1,
    startedAt: 1000,
    completedAt: 1001,
  }));
});
```

Add `test/assurance-terminal-trace.test.ts` with the complete flow:

1. Create an active run
2. Record a successful mutation transition
3. Assert run status `verification-pending`
4. Assert events contain `command_completed`, `workspace_mutated`, and `verification_required`
5. Assert event files do not contain the raw command or a secret marker
6. Record a failed verification and assert pending remains
7. Record a successful verification and assert status returns to `active`
8. Assert `verification_completed` exists
9. Call the integration with no active run and assert it returns `null`

- [ ] **Step 2: Run focused tests and confirm failure**

```bash
bun test test/terminal-runtime.test.ts test/assurance-terminal-trace.test.ts
```

Expected: FAIL because transition metadata and the integration module are absent.

- [ ] **Step 3: Update terminal postexec semantics**

Export:

```ts
export type TerminalPostexecTransition = Readonly<{
  kind: TerminalCommandKind;
  route: TaskProfile;
  commandDigest: string;
  exitCode: number;
  startedAt: number;
  completedAt: number;
}>;

export type TerminalPostexecResult = TerminalState & Readonly<{
  transition?: TerminalPostexecTransition;
}>;
```

Behavior changes:

- `recordTerminalPreexec` stores the pending command but does not set `evidencePending`
- `recordTerminalPostexec` sets pending only after a successful mutation
- It returns `transition` only when a pending command was consumed
- Repeated `postexec` calls without pending work produce no transition
- Existing stored version remains `1`

- [ ] **Step 4: Implement active-run terminal trace mapping**

`recordActiveRunTerminalTransition` receives:

```ts
{
  stateRoot: string;
  cwd: string;
  transition: TerminalPostexecTransition;
  now?: Date;
}
```

Mapping:

- Always append `command_completed` with digest, kind, route, exit code, and duration
- Successful mutation appends `workspace_mutated`, then `verification_required`, and sets `verification-pending`
- Successful verification appends `verification_completed` and sets `active` only when the run was pending
- Failed commands do not change the run status
- Missing active run returns `null`

- [ ] **Step 5: Wire the integration into `terminal postexec`**

In `src/harness-cli.ts`:

```ts
const result = await recordTerminalPostexec(dataDir(), key, exitCode);
if (result.transition) {
  await recordActiveRunTerminalTransition({
    stateRoot: resolveRiqorStateRoot(),
    cwd: process.cwd(),
    transition: result.transition,
  });
}
```

The terminal warning still uses the returned terminal state.

- [ ] **Step 6: Run focused tests and confirm pass**

```bash
bun test test/terminal-runtime.test.ts test/assurance-terminal-trace.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the task**

```bash
git add src/terminal-runtime.ts src/assurance/terminal-trace.ts src/harness-cli.ts test/terminal-runtime.test.ts test/assurance-terminal-trace.test.ts
git commit -m "feat: trace terminal evidence in active runs"
```

### Task 4: Run and trace CLI commands

**Files:**
- Create: `src/assurance/cli.ts`
- Modify: `src/harness-cli.ts`
- Test: `test/assurance-cli.test.ts`
- Modify: `test/harness-cli.test.ts`

**Interfaces:**
- Produces: `assuranceCommand(args: string[], options?): Promise<boolean>`
- `true` means the command was recognized and handled
- `false` means the existing harness CLI should continue routing

- [ ] **Step 1: Write failing CLI tests**

Use temporary Git repositories and set `RIQOR_STATE_HOME` for each process. Cover:

```bash
bun run src/harness-cli.ts run start --goal "Add trace records" --path evidence-loop --profile assured --json
bun run src/harness-cli.ts run status --json
bun run src/harness-cli.ts trace show <run-id> --json
bun run src/harness-cli.ts trace export <run-id> --format jsonl
bun run src/harness-cli.ts run complete --json
```

Assertions:

- `run start` returns the created record
- Unknown path and profile fail with exit 64
- Missing goal fails with exit 64
- `run status` returns the active record
- `trace show` returns an event array
- `trace export` emits valid JSONL with no wrapper
- `run complete` fails while verification is pending
- `run complete` succeeds after verification and clears active status
- Usage output lists `run` and `trace`

- [ ] **Step 2: Run the focused tests and confirm failure**

```bash
bun test test/assurance-cli.test.ts test/harness-cli.test.ts
```

Expected: FAIL because assurance CLI routing is absent.

- [ ] **Step 3: Implement CLI parsing and output**

Recognized forms:

```text
run start --goal <text> [--path <id>] [--profile standard|assured] [--parent-run <id>] [--json]
run status [--run <id>] [--json]
run complete [--run <id>] [--json]
trace show <run-id> [--json]
trace export <run-id> --format jsonl
```

Defaults:

- Path: `evidence-loop`
- Profile: `standard`
- State root: `resolveRiqorStateRoot()`
- Repository: `process.cwd()`

Human output is concise and contains run ID, status, path, profile, and current HEAD. JSON output uses the persisted shapes directly.

- [ ] **Step 4: Route commands before legacy harness routing**

Update the usage line and add near the start of `main`:

```ts
if (await assuranceCommand(args)) return;
```

The assurance CLI must return `false` for every unrelated command.

- [ ] **Step 5: Run focused tests and confirm pass**

```bash
bun test test/assurance-cli.test.ts test/harness-cli.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the task**

```bash
git add src/assurance/cli.ts src/harness-cli.ts test/assurance-cli.test.ts test/harness-cli.test.ts
git commit -m "feat: expose run and trace commands"
```

### Task 5: Documentation, package verification, and release gate

**Files:**
- Modify: `docs/CLI_REFERENCE.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/SECURITY_MODEL.md`
- Modify: `packages/riqor/README.md`
- Modify: `test/documentation.test.ts`

**Interfaces:**
- Documents the exact Phase 1 CLI and storage boundary
- Does not add repository automation content back to the public root README

- [ ] **Step 1: Add failing documentation assertions**

Add checks that:

- CLI reference contains every new command
- Architecture references `src/assurance/run-store.ts`
- Security model states raw commands and command output are excluded
- Package README includes one minimal run example
- Root `README.md` remains free of GitHub Actions and repository automation content

- [ ] **Step 2: Run documentation tests and confirm failure**

```bash
bun test test/documentation.test.ts test/public-repository.test.ts
```

Expected: FAIL because the new CLI is undocumented.

- [ ] **Step 3: Update focused documentation**

Document:

- Run lifecycle
- Repository-scoped active pointer
- Verification completion gate
- Trace event list
- State root and permission modes
- Privacy exclusions
- Compatibility and uninstall boundaries

Do not add implementation workflow badges or repository automation sections to the public root README.

- [ ] **Step 4: Run focused documentation tests**

```bash
bun test test/documentation.test.ts test/public-repository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run the complete verification gate**

```bash
bun install --frozen-lockfile
bun test
bun run plugin:health
bun run skills:health
bun run riqor:pack
bun run riqor:inspect -- packages/riqor/riqor-*.tgz
bun run riqor:test
bun run actions:verify
```

Expected: all commands exit 0.

- [ ] **Step 6: Run a privacy smoke test against the packaged CLI**

Use a temporary repository and state root:

```bash
RIQOR_STATE_HOME="$TMPDIR/riqor-state" node packages/riqor/dist/cli.mjs run start --goal "Package smoke" --json
RIQOR_STATE_HOME="$TMPDIR/riqor-state" node packages/riqor/dist/cli.mjs terminal preexec --session smoke --command 'printf sk-private-marker > src/a.ts'
RIQOR_STATE_HOME="$TMPDIR/riqor-state" node packages/riqor/dist/cli.mjs terminal postexec --session smoke --exit-code 0
! grep -R 'sk-private-marker' "$TMPDIR/riqor-state"
```

Expected: all commands exit 0 and the marker is absent from state.

- [ ] **Step 7: Commit the task**

```bash
git add docs/CLI_REFERENCE.md docs/ARCHITECTURE.md docs/SECURITY_MODEL.md packages/riqor/README.md test/documentation.test.ts
git commit -m "docs: document assured trace foundation"
```

- [ ] **Step 8: Open the Phase 1 pull request**

PR title:

```text
feat: add assured run trace foundation
```

PR body must include:

- Scope and explicit exclusions
- New public commands
- State and privacy boundary
- Exact verification commands and results
- Follow-up phases that remain unimplemented
