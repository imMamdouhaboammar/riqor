# Riqor Backlog Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a versioned hybrid backlog with strict records, generated views, deterministic linting, development roadmap, ecosystem ownership boundaries, and GitHub issue forms.

**Architecture:** YAML records under `backlog/` are authoritative. A dependency-free TypeScript library parses the records through Bun's built-in YAML parser, validates each record and cross-record invariants, then renders `BACKLOG.md` and `docs/backlog/CURRENT.md`. GitHub Issues remain optional execution mirrors and do not override repository state.

**Tech Stack:** TypeScript, Bun 1.3.14, Bun built-in YAML parser, JSON Schema draft 2020-12, Markdown, GitHub Issue Forms, Node standard library only

## Global Constraints

- Add no runtime dependency
- Do not change Riqor runtime, installer, terminal, plugin, or package behavior
- Do not add backlog content to the root product README
- Store no prompts, transcripts, source contents, command output, credentials, tokens, environment values, or private local paths
- Backlog YAML is authoritative; generated Markdown is not manually edited
- One item must remain independently deliverable by one pull request
- At most one `in-progress` item per initiative
- At most two `in-progress` items globally
- Unknown IDs, dependency cycles, malformed state requirements, and stale generated views fail closed
- Scripts must not invoke a shell or external service
- GitHub synchronization remains explicit and out of scope

---

### Task 1: Write the backlog design and implementation plan

**Files:**
- Create: `docs/superpowers/specs/2026-08-07-riqor-backlog-design.md`
- Create: `docs/superpowers/plans/2026-08-07-riqor-backlog-foundation.md`

**Interfaces:**
- Produces: approved backlog source-of-truth, lifecycle, ownership, release path, and implementation contract
- Consumes: current Riqor contribution policy and approved Assured Execution design

- [ ] **Step 1: Write the design specification**

The specification must define:

```text
source of truth
initiative and item units
status transitions
priority policy
WIP limits
Definition of Ready
Definition of Done
ecosystem ownership
initial initiatives
release path
commands
privacy boundary
explicit exclusions
```

- [ ] **Step 2: Scan the specification for placeholders and contradictions**

Run:

```bash
grep -RInE 'TBD|TODO|implement later|fill in' \
  docs/superpowers/specs/2026-08-07-riqor-backlog-design.md \
  docs/superpowers/plans/2026-08-07-riqor-backlog-foundation.md
```

Expected: no output

- [ ] **Step 3: Commit the design**

```bash
git add docs/superpowers/specs/2026-08-07-riqor-backlog-design.md \
  docs/superpowers/plans/2026-08-07-riqor-backlog-foundation.md
git commit -m "docs: define riqor backlog governance"
```

### Task 2: Define machine-readable backlog contracts

**Files:**
- Create: `schemas/backlog-initiative.schema.json`
- Create: `schemas/backlog-item.schema.json`
- Create: `scripts/backlog-lib.ts`
- Test: `test/backlog-schema.test.ts`

**Interfaces:**
- Produces: `loadBacklog(root: string): Promise<Backlog>`
- Produces: `validateBacklog(backlog: Backlog): string[]`
- Produces: `assertBacklogValid(backlog: Backlog): void`
- Produces: `Backlog`, `BacklogInitiative`, and `BacklogItem` types
- Consumes: Bun built-in YAML parser through `globalThis.Bun.YAML.parse`

- [ ] **Step 1: Write failing schema tests**

Create `test/backlog-schema.test.ts` with assertions that:

```ts
const backlog = await loadBacklog(root);
expect(validateBacklog(backlog)).toEqual([]);
expect(backlog.initiatives.length).toBe(5);
expect(backlog.items.length).toBeGreaterThanOrEqual(16);
```

Also parse both JSON schemas and assert:

```ts
expect(initiativeSchema.$schema).toContain("2020-12");
expect(itemSchema.additionalProperties).toBe(false);
```

- [ ] **Step 2: Run the focused test and confirm failure**

```bash
bun test test/backlog-schema.test.ts
```

Expected: fail because schemas and `scripts/backlog-lib.ts` do not exist

- [ ] **Step 3: Implement strict record loading**

`loadBacklog` must:

```ts
export async function loadBacklog(root: string): Promise<Backlog>;
```

Behavior:

- read only `.yml` files from `backlog/initiatives` and `backlog/items`
- parse with `Bun.YAML.parse`
- reject multi-document YAML
- keep source path on the in-memory record only
- sort initiatives and items by ID before returning

- [ ] **Step 4: Implement record validation**

`validateBacklog` must report all errors in one run and check:

```text
required fields and allowed enums
ID and filename consistency
unique IDs across all records
initiative item references
item initiative reverse references
dependency existence
self-dependencies
dependency cycles
blocked-state details
in-progress PR metadata
done-state completion evidence
at least one acceptance command
at least one evidence type
WIP limits
```

- [ ] **Step 5: Run the focused test**

```bash
bun test test/backlog-schema.test.ts
```

Expected: fail because no backlog records exist yet

- [ ] **Step 6: Commit the contracts**

```bash
git add schemas/backlog-initiative.schema.json schemas/backlog-item.schema.json \
  scripts/backlog-lib.ts test/backlog-schema.test.ts
git commit -m "feat: add backlog record contracts"
```

### Task 3: Add initiatives and delivery items

**Files:**
- Create: `backlog/initiatives/RIQ-001-assured-execution.yml`
- Create: `backlog/initiatives/RIQ-002-ecosystem-integration.yml`
- Create: `backlog/initiatives/RIQ-003-recovery-and-review.yml`
- Create: `backlog/initiatives/RIQ-004-deterministic-evaluation.yml`
- Create: `backlog/initiatives/RIQ-005-github-plan-bridge.yml`
- Create: `backlog/items/*.yml`
- Create: `backlog/archive/.gitkeep`

**Interfaces:**
- Consumes: JSON schema and TypeScript contracts from Task 2
- Produces: five initiatives and the initial executable delivery queue

- [ ] **Step 1: Add the five initiative records**

Each initiative must include exact item IDs, release targets, success measures, scope, exclusions, and inspiration concepts.

- [ ] **Step 2: Add the current and near-term items**

Minimum item set:

```text
RIQ-101 Trace Foundation merge
RIQ-102 Assured Ledger and cards
RIQ-103 State-adaptive context
RIQ-104 Failure attribution and budgets
RIQ-105 Phase boundary guards
RIQ-201 Capability registry
RIQ-202 Agent Kernel read-only adapter
RIQ-203 Delegate Team read-only adapter
RIQ-204 Dokion read-only adapter
RIQ-301 Checkpoint creation
RIQ-302 Repository-bound resume
RIQ-303 Approval digest binding
RIQ-401 Assured execution scenarios
RIQ-402 Privacy regression pack
RIQ-501 GitHub plan bridge
RIQ-502 Backlog drift report
```

- [ ] **Step 3: Run the schema test**

```bash
bun test test/backlog-schema.test.ts
```

Expected: pass

- [ ] **Step 4: Commit the records**

```bash
git add backlog
git commit -m "docs: seed riqor development backlog"
```

### Task 4: Generate portfolio and current-focus views

**Files:**
- Modify: `scripts/backlog-lib.ts`
- Create: `scripts/backlog-report.ts`
- Create: `BACKLOG.md`
- Create: `docs/backlog/CURRENT.md`
- Test: `test/backlog-integrity.test.ts`

**Interfaces:**
- Produces: `renderBacklogMarkdown(backlog: Backlog): string`
- Produces: `renderCurrentMarkdown(backlog: Backlog): string`
- Produces CLI modes: default stdout, `--write`, and `--check`
- Consumes: validated `Backlog`

- [ ] **Step 1: Write failing generated-view tests**

Assertions:

```ts
const backlog = await loadBacklog(root);
assertBacklogValid(backlog);
expect(await readFile(join(root, "BACKLOG.md"), "utf8"))
  .toBe(renderBacklogMarkdown(backlog));
expect(await readFile(join(root, "docs/backlog/CURRENT.md"), "utf8"))
  .toBe(renderCurrentMarkdown(backlog));
```

Also assert:

```ts
expect(backlog.items.find((item) => item.id === "RIQ-101")?.github.pr).toBe(8);
expect(backlog.items.filter((item) => item.status === "in-progress")).toHaveLength(1);
```

- [ ] **Step 2: Run and confirm failure**

```bash
bun test test/backlog-integrity.test.ts
```

Expected: fail because generated views and report script do not exist

- [ ] **Step 3: Implement deterministic rendering**

`BACKLOG.md` must include:

```text
generated-file warning
current focus table
initiative map
status summary
commands
governance links
```

`docs/backlog/CURRENT.md` must include:

```text
active work
next queue
blockers
WIP limits
release target
```

- [ ] **Step 4: Implement report modes**

```bash
bun run scripts/backlog-report.ts
bun run scripts/backlog-report.ts --write
bun run scripts/backlog-report.ts --check
```

`--check` exits non-zero when either generated file differs.

- [ ] **Step 5: Generate the views**

```bash
bun run scripts/backlog-report.ts --write
```

- [ ] **Step 6: Run focused tests**

```bash
bun test test/backlog-schema.test.ts test/backlog-integrity.test.ts
```

Expected: pass

- [ ] **Step 7: Commit reporting**

```bash
git add scripts/backlog-lib.ts scripts/backlog-report.ts BACKLOG.md \
  docs/backlog/CURRENT.md test/backlog-integrity.test.ts
git commit -m "feat: generate backlog development views"
```

### Task 5: Add operating documentation and issue forms

**Files:**
- Create: `docs/backlog/README.md`
- Create: `docs/backlog/ROADMAP.md`
- Create: `docs/backlog/TRIAGE.md`
- Create: `docs/backlog/ECOSYSTEM_BOUNDARIES.md`
- Create: `docs/backlog/RELEASE_TRAINS.md`
- Create: `.github/ISSUE_TEMPLATE/initiative.yml`
- Create: `.github/ISSUE_TEMPLATE/backlog_item.yml`
- Create: `.github/ISSUE_TEMPLATE/phase.yml`
- Modify: `docs/README.md`
- Modify: `CONTRIBUTING.md`

**Interfaces:**
- Produces: maintainer operating process and GitHub execution mirror templates
- Consumes: lifecycle, ownership, release path, and generated views

- [ ] **Step 1: Document the operating workflow**

The documentation must define:

```text
how to propose an item
how to triage it
how to move it to ready
how to start and review work
how to close with evidence
how to handle blocked and deferred work
how to avoid cross-project ownership duplication
```

- [ ] **Step 2: Add Issue Forms**

Issue Forms must collect:

```text
backlog ID
problem
observable outcome
included and excluded scope
dependencies
acceptance commands
evidence
risk
release target
source record path
```

- [ ] **Step 3: Update contribution entry points**

Add the backlog guide to `docs/README.md` and add a backlog workflow section to `CONTRIBUTING.md`.

Do not add backlog navigation to the root product README.

- [ ] **Step 4: Run documentation tests**

```bash
bun test test/documentation.test.ts test/public-repository.test.ts \
  test/backlog-schema.test.ts test/backlog-integrity.test.ts
```

Expected: pass

- [ ] **Step 5: Commit documentation**

```bash
git add docs/backlog .github/ISSUE_TEMPLATE docs/README.md CONTRIBUTING.md
git commit -m "docs: add backlog operating workflow"
```

### Task 6: Wire repository commands and final integrity gate

**Files:**
- Modify: `package.json`
- Create: `scripts/backlog-lint.ts`
- Modify: `test/backlog-integrity.test.ts`

**Interfaces:**
- Produces package scripts:
  - `backlog:lint`
  - `backlog:report`
  - `backlog:sync`
  - `backlog:check`

- [ ] **Step 1: Add command contract tests**

Read `package.json` and assert:

```ts
expect(pkg.scripts["backlog:lint"]).toBe("bun run scripts/backlog-lint.ts");
expect(pkg.scripts["backlog:report"]).toBe("bun run scripts/backlog-report.ts");
expect(pkg.scripts["backlog:sync"]).toBe("bun run scripts/backlog-report.ts --write");
expect(pkg.scripts["backlog:check"])
  .toBe("bun run backlog:lint && bun run scripts/backlog-report.ts --check");
```

- [ ] **Step 2: Run and confirm failure**

```bash
bun test test/backlog-integrity.test.ts
```

Expected: fail because package scripts and lint CLI are missing

- [ ] **Step 3: Implement the lint CLI**

```ts
const backlog = await loadBacklog(root);
const errors = validateBacklog(backlog);
if (errors.length > 0) {
  process.stderr.write(errors.map((error) => `- ${error}`).join("\n") + "\n");
  process.exitCode = 1;
} else {
  process.stdout.write(
    `backlog valid: ${backlog.initiatives.length} initiatives, ${backlog.items.length} items\n`,
  );
}
```

- [ ] **Step 4: Add package scripts**

Add the four exact commands from the interface block without changing existing scripts.

- [ ] **Step 5: Run the backlog gate**

```bash
bun run backlog:check
bun test test/backlog-schema.test.ts test/backlog-integrity.test.ts
```

Expected: pass

- [ ] **Step 6: Run the repository documentation and workflow gate**

```bash
bun test test/documentation.test.ts test/public-repository.test.ts \
  test/github-workflows.test.ts
bun run actions:verify
```

Expected: pass

- [ ] **Step 7: Review the complete diff**

Check:

```bash
git diff --check
git diff --stat main...HEAD
git grep -nE 'TBD|TODO|YOUR_NAME|/Users/|sk-[A-Za-z0-9]'
```

Expected: no placeholders, private local paths, or secrets in new backlog files

- [ ] **Step 8: Open a pull request**

PR title:

```text
feat: add governed development backlog
```

The PR body must report exact current-head evidence and explicitly state that GitHub issue synchronization is not automatic.
