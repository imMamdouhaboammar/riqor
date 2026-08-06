# GitHub Actions Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore trustworthy green workflow badges and verify CI, SecureAI-Scan, AutoDemo, and Dynamic Badges on `main`.

**Architecture:** Keep workflow behavior unchanged unless runtime evidence proves a workflow defect. Fix the Bun-specific documentation assertion, scope README workflow badges to `main`, and use GitHub Actions as the authoritative verification environment.

**Tech Stack:** Bun 1.3.14, TypeScript tests, GitHub Actions, Shields workflow badges, Dynamic Badges Gist endpoints

## Global Constraints

- Preserve exact action SHA pins
- Do not weaken CI, security scanning, or artifact checks
- Do not publish a success badge from a pull request or cancelled run
- Verify the final commit on `main`

---

### Task 1: Add regression coverage for workflow badge scope

**Files:**
- Modify: `test/public-repository.test.ts`
- Test: `test/public-repository.test.ts`

**Interfaces:**
- Consumes: `README.md`
- Produces: an assertion that each GitHub workflow badge image is scoped to `branch=main`

- [ ] **Step 1: Write the failing assertion**

Add an assertion for each workflow badge URL:

```ts
for (const workflow of ["ci.yml", "secureai.yml", "autodemo.yml"]) {
  expect(readme).toContain(`actions/workflows/${workflow}/badge.svg?branch=main`);
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test test/public-repository.test.ts`
Expected: FAIL because the current README badge image URLs do not include `?branch=main`

- [ ] **Step 3: Commit the red test**

```bash
git add test/public-repository.test.ts
git commit -m "test: require main-scoped workflow badges"
```

### Task 2: Fix the Bun documentation assertion and badge URLs

**Files:**
- Modify: `test/documentation.test.ts`
- Modify: `README.md`
- Test: `test/documentation.test.ts`
- Test: `test/public-repository.test.ts`

**Interfaces:**
- Consumes: successful `node:fs/promises.access()` calls and workflow badge URLs
- Produces: runtime-neutral file existence checks and default-branch badge status

- [ ] **Step 1: Replace matcher-wrapped access calls**

Replace:

```ts
await expect(access(path)).resolves.toBeUndefined();
```

with:

```ts
await access(path);
```

- [ ] **Step 2: Scope workflow badge images to main**

Use these image URLs:

```text
https://github.com/imMamdouhaboammar/riqor/actions/workflows/ci.yml/badge.svg?branch=main
https://github.com/imMamdouhaboammar/riqor/actions/workflows/secureai.yml/badge.svg?branch=main
https://github.com/imMamdouhaboammar/riqor/actions/workflows/autodemo.yml/badge.svg?branch=main
```

- [ ] **Step 3: Run focused tests**

Run: `bun test test/documentation.test.ts test/public-repository.test.ts`
Expected: PASS with zero failures

- [ ] **Step 4: Run the full repository gate**

Run:

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

Expected: every command exits 0

### Task 3: Verify hosted workflows and Gist publishing

**Files:**
- Review: `.github/workflows/ci.yml`
- Review: `.github/workflows/secureai.yml`
- Review: `.github/workflows/autodemo.yml`
- Review: `.github/workflows/dynamic-badges.yml`

**Interfaces:**
- Consumes: the pull request commit, final `main` commit, `GIST_SECRET`, and `RIQOR_BADGES_GIST_ID`
- Produces: green workflow runs and updated Gist JSON files

- [ ] **Step 1: Open a pull request and inspect CI, SecureAI-Scan, and AutoDemo results**

Expected: CI passes, SecureAI-Scan completes without high-severity findings, and AutoDemo produces its artifact

- [ ] **Step 2: Merge only after required checks pass**

Use squash merge into `main`

- [ ] **Step 3: Verify the final main commit**

Expected: CI and SecureAI-Scan complete successfully on `main`; AutoDemo completes when its path filter or manual dispatch is used

- [ ] **Step 4: Verify Dynamic Badges**

Expected: the workflow triggered by successful CI on `main` updates both `riqor-quality-gate.json` and `riqor-version.json` in the configured Gist
