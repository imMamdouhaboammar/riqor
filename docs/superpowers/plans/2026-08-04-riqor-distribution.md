# Riqor Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking

**Goal:** Ship Riqor as a tested npm package, public GitHub repository, GitHub release, and Homebrew Formula while preserving the existing Codex Plugin and local session behavior

**Architecture:** Keep the current repository as the canonical source and add `packages/riqor` as the only npm-publishable package. Build its runtime payload from reviewed root files through an explicit allowlist, run all install checks from the packed tarball, then publish the same tagged version to GitHub, npm, and the Homebrew tap

**Tech Stack:** Bun 1.3.14 or newer, TypeScript, Node.js 22 or newer for the public package, Bash, Python 3.7 or newer, npm registry, GitHub CLI, GitHub Actions, Homebrew Ruby Formula

## Global Constraints

- Public product name is `Riqor`
- Public npm package and executable are `riqor`
- Public repository is `imMamdouhaboammar/riqor`
- Homebrew command is `brew install imMamdouhaboammar/tap/riqor`
- First public release keeps `codex-self-improvement@codex-self-improvement-dev` as the internal Plugin selector
- Keep `codex-harness` and `cxh` as compatibility aliases
- Never replace the original `codex`, `kaku`, `node`, npm, Bun, or Homebrew executables
- `brew install` must not edit shell files or install the Codex Plugin
- User environment changes begin only after `riqor install`
- npm tarballs and release artifacts must exclude credentials, prompts, commands, outputs, source contents, local state, absolute machine paths, caches, fixtures, work directories, and Finder metadata
- Publishing must fail closed when tests, package inspection, checksums, provenance, or ownership preflight fail
- Public claims must match measured repository evidence
- Use Bun for repository scripts, tests, builds, and package preparation
- Public npm and Homebrew users require Node.js 22 or newer and do not require Bun
- Use npm only for registry identity checks, `npm pack`, local tarball installation, and publishing
- Use atomic commits after each independently testable task

---## File Map

### New public package files

- `packages/riqor/package.json` defines npm identity, binaries, engines, files allowlist, repository metadata, and publish scripts
- `packages/riqor/bin/riqor.mjs` is the portable executable entrypoint
- `packages/riqor/src/paths.ts` resolves package payload, user directories, and compatibility locations
- `packages/riqor/src/cli.ts` parses public commands and delegates to focused command modules
- `packages/riqor/src/commands/install.ts` installs shell integration and the packaged Codex Plugin transactionally
- `packages/riqor/src/commands/doctor.ts` reports package, Plugin, shell, Kaku, and external Codex observations separately
- `packages/riqor/src/commands/status.ts` returns bounded version and surface inventory
- `packages/riqor/src/commands/uninstall.ts` removes only files recorded in the install manifest
- `packages/riqor/src/process.ts` runs child commands with explicit environment and bounded output
- `packages/riqor/src/types.ts` defines shared public records
- `packages/riqor/runtime/` is generated from reviewed root runtime files
- `packages/riqor/test/` contains package-local CLI, install, tarball, and rollback tests

### New root release files

- `scripts/build-riqor-package.ts` copies only approved runtime files and writes provenance metadata
- `scripts/inspect-riqor-tarball.ts` rejects unexpected or credential-shaped archive entries
- `scripts/release-preflight.ts` checks GitHub, npm, version, repository cleanliness, and required tools
- `scripts/generate-homebrew-formula.ts` renders Formula content from a release URL and SHA-256
- `scripts/verify-release-artifacts.ts` checks version and digest agreement across all release outputs
- `Formula/riqor.rb` is the generated Formula used for local syntax and install tests
- `.github/workflows/ci.yml` runs tests and package gates
- `.github/workflows/release.yml` builds signed release outputs and publishes only after all gates
- `.github/ISSUE_TEMPLATE/bug_report.yml` captures reproducible defects
- `.github/ISSUE_TEMPLATE/integration_request.yml` captures new agent and terminal integrations
- `.github/ISSUE_TEMPLATE/good_first_issue.yml` provides newcomer issue guidance
- `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, and `CHANGELOG.md` complete the public repository surface

### Task 1: Extract package-independent runtime contracts

**Files:**
- Create: `src/runtime-paths.ts`
- Modify: `src/harness-cli.ts`
- Modify: `scripts/install-shell-integration.py`
- Modify: `scripts/uninstall-shell-integration.py`
- Test: `test/runtime-paths.test.ts`
- Test: `test/harness-cli.test.ts`

**Interfaces:**
- Produces: `resolveRuntimeLayout(options?: RuntimeLayoutOptions): RuntimeLayout`
- Produces: `RuntimeLayout` with `packageRoot`, `runtimeRoot`, `pluginRoot`, `scriptsRoot`, `shellTemplatesRoot`, `packageJsonPath`, and `distribution`
- Consumes: optional `RIQOR_PACKAGE_ROOT` and `RIQOR_RUNTIME_ROOT` for packaged execution and current repository root for development execution

- [ ] **Step 1: Write the failing runtime-layout tests**

```ts
import { describe, expect, test } from "bun:test"
import { resolveRuntimeLayout } from "../src/runtime-paths"

describe("runtime layout", () => {
  test("uses repository layout during development", () => {
    const layout = resolveRuntimeLayout({ moduleDirectory: `${process.cwd()}/src`, env: {} })
    expect(layout.distribution).toBe("repository")
    expect(layout.pluginRoot).toEndWith("plugins/codex-self-improvement")
  })

  test("uses an explicit packaged payload", () => {
    const layout = resolveRuntimeLayout({
      moduleDirectory: "/package/src",
      env: {
        RIQOR_PACKAGE_ROOT: "/package",
        RIQOR_RUNTIME_ROOT: "/package/runtime",
      },
    })
    expect(layout.distribution).toBe("package")
    expect(layout.packageJsonPath).toBe("/package/package.json")
    expect(layout.pluginRoot).toBe("/package/runtime/plugins/codex-self-improvement")
  })
})
```

- [ ] **Step 2: Run the focused tests and confirm the missing module failure**

Run: `bun test test/runtime-paths.test.ts test/harness-cli.test.ts`

Expected: FAIL because `src/runtime-paths.ts` does not exist

- [ ] **Step 3: Add the minimal runtime-layout implementation**

```ts
import { resolve } from "node:path"

export type RuntimeLayoutOptions = {
  moduleDirectory?: string
  env?: Record<string, string | undefined>
}

export type RuntimeLayout = {
  packageRoot: string
  runtimeRoot: string
  pluginRoot: string
  scriptsRoot: string
  shellTemplatesRoot: string
  packageJsonPath: string
  distribution: "repository" | "package"
}

export function resolveRuntimeLayout(options: RuntimeLayoutOptions = {}): RuntimeLayout {
  const env = options.env ?? process.env
  const repositoryRoot = resolve(options.moduleDirectory ?? import.meta.dir, "..")
  const runtimeRoot = resolve(env.RIQOR_RUNTIME_ROOT ?? repositoryRoot)
  const packageRoot = resolve(env.RIQOR_PACKAGE_ROOT ?? repositoryRoot)
  const distribution = env.RIQOR_RUNTIME_ROOT ? "package" : "repository"
  return {
    packageRoot,
    runtimeRoot,
    pluginRoot: resolve(runtimeRoot, "plugins", "codex-self-improvement"),
    scriptsRoot: resolve(runtimeRoot, "scripts"),
    shellTemplatesRoot: resolve(runtimeRoot, "config", "shell"),
    packageJsonPath: resolve(packageRoot, "package.json"),
    distribution,
  }
}
```

- [ ] **Step 4: Refactor the CLI and installers to consume the layout**

Replace direct `resolve(import.meta.dir, "..")` and repository-relative assumptions with one `resolveRuntimeLayout()` call

Pass these explicit environment variables from the public package later

```text
RIQOR_PACKAGE_ROOT=/tmp/riqor-package
RIQOR_RUNTIME_ROOT=/tmp/riqor-package/runtime
RIQOR_EXECUTABLE_NAME=riqor
```

Preserve current development behavior when neither variable is present

- [ ] **Step 5: Run focused and regression tests**

Run: `bun test test/runtime-paths.test.ts test/harness-cli.test.ts test/shell-installer.test.ts test/plugin-scripts.test.ts`

Expected: PASS with existing `codex-harness` behavior unchanged

- [ ] **Step 6: Commit**

```bash
git add src/runtime-paths.ts src/harness-cli.ts scripts/install-shell-integration.py scripts/uninstall-shell-integration.py test/runtime-paths.test.ts test/harness-cli.test.ts
git commit -m "refactor: make Riqor runtime relocatable"
```

### Task 2: Add the public Riqor command identity

**Files:**
- Create: `src/command-brand.ts`
- Modify: `src/harness-cli.ts`
- Modify: `config/shell/codex-self-improvement-env.zsh`
- Modify: `config/shell/codex-self-improvement-kaku.zsh`
- Modify: `scripts/install-shell-integration.py`
- Modify: `plugins/codex-self-improvement/.codex-plugin/plugin.json`
- Modify: `plugins/codex-self-improvement/hooks/main.ts`
- Modify: `plugins/codex-self-improvement/hooks/hooks.json`
- Test: `test/command-brand.test.ts`
- Test: `test/harness-cli.test.ts`
- Test: `test/shell-integration.test.ts`

**Interfaces:**
- Produces: `resolveCommandBrand(argv0?: string, env?: NodeJS.ProcessEnv): CommandBrand`
- Produces: `CommandBrand` with `name`, `displayName`, `compatibilityNames`, `stateDirectoryName`, and `environmentPrefix`
- Consumes: executable basename or `RIQOR_EXECUTABLE_NAME`

- [ ] **Step 1: Write failing brand and output tests**

```ts
import { expect, test } from "bun:test"
import { resolveCommandBrand } from "../src/command-brand"

test("uses Riqor for the public executable", () => {
  expect(resolveCommandBrand("/usr/local/bin/riqor", {})).toMatchObject({
    name: "riqor",
    displayName: "Riqor",
    compatibilityNames: ["codex-harness", "cxh"],
  })
})

test("preserves the compatibility command name", () => {
  expect(resolveCommandBrand("/usr/local/bin/codex-harness", {}).name).toBe("codex-harness")
})
```

Add CLI assertions that `riqor version --json` reports `name: "riqor"` while `codex-harness version --json` remains accepted

Add Plugin assertions that `manifest.name` stays `codex-self-improvement`, `manifest.interface.displayName` becomes `Riqor Agent Runtime`, and hook guidance uses `Riqor` without changing the marketplace selector

- [ ] **Step 2: Run tests and confirm they fail**

Run: `bun test test/command-brand.test.ts test/harness-cli.test.ts test/shell-integration.test.ts`

Expected: FAIL because public branding and the `riqor` wrapper do not exist

- [ ] **Step 3: Implement command branding and message migration**

```ts
export type CommandBrand = Readonly<{
  name: "riqor" | "codex-harness" | "cxh"
  displayName: "Riqor" | "Codex Self Improvement"
  compatibilityNames: readonly ["codex-harness", "cxh"]
  stateDirectoryName: "riqor"
  environmentPrefix: "RIQOR"
}>
```

Use `Riqor` in public messages and retain old environment variables as read-only fallbacks during the first release

The public package uses `RIQOR_*` variables only, while repository compatibility wrappers translate legacy `CODEX_SELF_IMPROVEMENT_*` variables at the boundary

Write new state under `${XDG_STATE_HOME:-$HOME/.local/state}/riqor` and read the old state directory only when the new file is absent

Change user-visible hook context, evidence reminders, and health descriptions to `Riqor`, while preserving `codex-self-improvement@codex-self-improvement-dev` as the installation identity

- [ ] **Step 4: Update shell aliases without shadowing original tools**

Install these managed entries

```zsh
alias codex-harness='riqor'
alias cxh='riqor'
```

Do not create an alias or function that replaces `codex` outside the existing Kaku wrapper behavior

- [ ] **Step 5: Run focused tests and package health**

Run: `bun test test/command-brand.test.ts test/harness-cli.test.ts test/shell-integration.test.ts test/shell-installer.test.ts`

Run: `bun run plugin:health`

Expected: all checks pass and current plugin selector remains unchanged

- [ ] **Step 6: Commit**

```bash
git add src/command-brand.ts src/harness-cli.ts config/shell scripts/install-shell-integration.py plugins/codex-self-improvement/.codex-plugin/plugin.json plugins/codex-self-improvement/hooks/main.ts plugins/codex-self-improvement/hooks/hooks.json test/command-brand.test.ts test/harness-cli.test.ts test/shell-integration.test.ts test/plugin-package.test.ts test/plugin-hooks.test.ts
git commit -m "feat: add Riqor command identity"
```

### Task 3: Build the isolated npm package and runtime payload

**Files:**
- Create: `packages/riqor/package.json`
- Create: `packages/riqor/bin/riqor.mjs`
- Create: `packages/riqor/src/cli.ts`
- Create: `packages/riqor/README.md`
- Create: `scripts/build-riqor-package.ts`
- Create: `plugins/codex-self-improvement/hooks/io.ts`
- Create: `bun.lock`
- Create: `scripts/inspect-riqor-tarball.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Test: `test/riqor-package-build.test.ts`
- Test: `test/riqor-tarball.test.ts`

**Interfaces:**
- Produces: `buildRiqorPackage(options?: BuildOptions): Promise<BuildReport>`
- Produces: `inspectRiqorTarball(path: string): Promise<TarballReport>`
- Produces: package binary `riqor`
- Produces: Node-compatible Plugin hook bundle `runtime/plugins/codex-self-improvement/hooks/main.mjs`
- Consumes: runtime allowlist declared in `scripts/build-riqor-package.ts`

```ts
export type BuildOptions = Readonly<{
  repositoryRoot?: string
  packageRoot?: string
  sourceDateEpoch?: number
}>

export type BuildReport = Readonly<{
  packageRoot: string
  version: string
  sourceCommit: string
  files: readonly { path: string; sha256: string; bytes: number }[]
}>

export type TarballReport = Readonly<{
  ok: boolean
  entries: readonly string[]
  errors: readonly string[]
}>
```

- [ ] **Step 1: Write failing package metadata and tarball tests**

```ts
expect(pkg).toMatchObject({
  name: "riqor",
  version: "0.1.0",
  type: "module",
  bin: {
    riqor: "bin/riqor.mjs",
    "codex-harness": "bin/riqor.mjs",
    cxh: "bin/riqor.mjs",
  },
  engines: { node: ">=22" },
})
expect(pkg.files).toEqual(["bin", "dist", "runtime", "README.md", "LICENSE"])
```

The tarball test must reject any entry matching

```ts
/(?:^|\/)(?:auth\.json|\.env(?:\.|$)|credentials?|secrets?|\.DS_Store|work|fixtures|test)(?:\/|$)/i
```

- [ ] **Step 2: Run tests and confirm missing package failures**

Run: `bun test test/riqor-package-build.test.ts test/riqor-tarball.test.ts`

Expected: FAIL because `packages/riqor` and build scripts do not exist

- [ ] **Step 3: Add exact npm package metadata**

```json
{
  "name": "riqor",
  "version": "0.1.0",
  "description": "Evidence gates and session continuity for AI coding agents",
  "type": "module",
  "license": "MIT",
  "bin": {
    "riqor": "bin/riqor.mjs",
    "codex-harness": "bin/riqor.mjs",
    "cxh": "bin/riqor.mjs"
  },
  "engines": { "node": ">=22" },
  "files": ["bin", "dist", "runtime", "README.md", "LICENSE"],
  "publishConfig": { "access": "public", "provenance": true }
}
```

Add repository, bugs, homepage, keywords, author, and funding metadata using the approved GitHub identity

Run `bun install --lockfile-only` after package metadata exists and commit the generated `bun.lock` before CI uses `--frozen-lockfile`

- [ ] **Step 4: Build a package payload through an explicit allowlist**

The build script copies only static Plugin manifests, Plugin metadata, skills, shell templates, marketplace metadata, lock records, and policy metadata

It compiles TypeScript runtime code instead of publishing source that requires Bun

```ts
const staticRuntimeFiles = [
  "plugins/codex-self-improvement/.codex-plugin/plugin.json",
  "plugins/codex-self-improvement/package.json",
  "plugins/codex-self-improvement/skills",
  "config/shell",
  ".agents/plugins/marketplace.json",
  "skills-lock.json",
  "config/skill-curation.json"
] as const
```

Build these Node 22 artifacts with Bun as the repository build tool

```bash
bun build packages/riqor/src/cli.ts --target=node --format=esm --outfile packages/riqor/dist/cli.mjs
bun build plugins/codex-self-improvement/hooks/main.ts --target=node --format=esm --outfile packages/riqor/runtime/plugins/codex-self-improvement/hooks/main.mjs
```

Generate the packaged `hooks/hooks.json` from the source hook map and replace every command with

```text
node "${PLUGIN_ROOT}/hooks/main.mjs"
```

The packaged hook bundle must use `process.stdin` rather than `Bun.stdin`, so create `plugins/codex-self-improvement/hooks/io.ts` with these interfaces and update `main.ts` before bundling

```ts
export async function readStdinText(stream: NodeJS.ReadStream = process.stdin): Promise<string>
export function isMainModule(metaUrl: string, argv1: string | undefined = process.argv[1]): boolean
```

Replace `import.meta.main` with `isMainModule(import.meta.url)` so the same source runs under Bun during repository tests and under Node after bundling

Generate `packages/riqor/runtime/provenance.json` with version, source commit, `sourceDateEpoch` from `git show -s --format=%ct HEAD`, and SHA-256 for each copied or generated file

Copy root `LICENSE` and the package README into `packages/riqor` before packing

Reject symlinks, absolute paths, files outside the repository, files named `.DS_Store`, and any packaged runtime command that invokes `bun` or Python

Add a packaged-hook smoke test that executes

```bash
node packages/riqor/runtime/plugins/codex-self-improvement/hooks/main.mjs
```

with a `SessionStart` JSON object on stdin and asserts that the output contains Riqor session guidance and a bounded runtime marker

Build the package twice with the same commit and assert identical SHA-256 values for every generated file and both npm tarballs

- [ ] **Step 5: Add the Node entrypoint**

`bin/riqor.mjs` must resolve its own package directory, set `RIQOR_RUNTIME_ROOT`, import the Node 22 bundle `dist/cli.mjs`, and forward `process.argv.slice(2)`

```js
#!/usr/bin/env node
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
process.env.RIQOR_PACKAGE_ROOT ??= packageRoot
process.env.RIQOR_RUNTIME_ROOT ??= resolve(packageRoot, "runtime")
process.env.RIQOR_EXECUTABLE_NAME ??= "riqor"
const { main } = await import("../dist/cli.mjs")
await main(process.argv.slice(2))
```

- [ ] **Step 6: Add package scripts and inspect the real tarball**

Add root scripts

```json
"riqor:build": "bun run scripts/build-riqor-package.ts",
"riqor:pack": "bun run riqor:build && cd packages/riqor && npm pack --json",
"riqor:inspect": "bun run scripts/inspect-riqor-tarball.ts",
"riqor:test": "bun test test/riqor-*.test.ts packages/riqor/test"
```

Run: `bun run riqor:pack`

Run: `bun run riqor:inspect -- packages/riqor/riqor-0.1.0.tgz`

Expected: tarball contains only the declared package files and all provenance hashes verify

- [ ] **Step 7: Commit**

```bash
git add packages/riqor plugins/codex-self-improvement/hooks/io.ts plugins/codex-self-improvement/hooks/main.ts scripts/build-riqor-package.ts scripts/inspect-riqor-tarball.ts package.json bun.lock .gitignore test/riqor-package-build.test.ts test/riqor-tarball.test.ts
git commit -m "feat: package Riqor for npm"
```

### Task 4: Make install, doctor, status, and uninstall work from the packed tarball

**Files:**
- Create: `packages/riqor/src/types.ts`
- Create: `packages/riqor/src/process.ts`
- Create: `packages/riqor/src/commands/install.ts`
- Create: `packages/riqor/src/commands/doctor.ts`
- Create: `packages/riqor/src/commands/status.ts`
- Create: `packages/riqor/src/commands/uninstall.ts`
- Modify: `packages/riqor/src/cli.ts`
- Modify: `scripts/install-shell-integration.py`
- Modify: `scripts/uninstall-shell-integration.py`
- Test: `packages/riqor/test/cli.test.ts`
- Test: `packages/riqor/test/install-tarball.test.ts`
- Test: `packages/riqor/test/rollback.test.ts`

**Interfaces:**
- Produces: `runCommand(command: string[], options?: RunOptions): CommandResult`
- Produces: `install(options: InstallOptions): Promise<InstallReport>`
- Produces: `doctor(options: DoctorOptions): Promise<DoctorReport>`
- Produces: `status(options: StatusOptions): Promise<StatusReport>`
- Produces: `uninstall(options: UninstallOptions): Promise<UninstallReport>`
- Produces: a persistent user runtime at `${XDG_DATA_HOME:-$HOME/.local/share}/riqor/0.1.0` with an atomic `current` link
- Consumes: package runtime layout from Task 1 and command brand from Task 2

```ts
export type RunOptions = Readonly<{
  cwd?: string
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
}>

export type CommandResult = Readonly<{
  exitCode: number
  stdout: string
  stderr: string
}>

export type InstallOptions = Readonly<{ home?: string; codexHome?: string; json?: boolean }>
export type DoctorOptions = Readonly<{ home?: string; codexHome?: string; packageOnly?: boolean }>
export type StatusOptions = Readonly<{ home?: string; codexHome?: string }>
export type UninstallOptions = Readonly<{ home?: string; codexHome?: string }>
export type DoctorReport = Readonly<{ ok: boolean; checks: readonly CheckRecord[]; externalIssues: readonly string[] }>
export type StatusReport = Readonly<{ version: string; pluginVersion: string; surfaces: Readonly<Record<string, string>> }>
export type UninstallReport = Readonly<{ ok: boolean; removed: readonly string[]; restored: readonly string[] }>
export type MarketplaceState = "absent" | "current" | "legacy-compatible" | "conflict"
```

- [ ] **Step 1: Write failing CLI dispatch tests**

```ts
expect(await invoke(["version", "--json"])).toMatchObject({ exitCode: 0 })
expect(JSON.parse((await invoke(["version", "--json"])).stdout)).toMatchObject({
  name: "riqor",
  version: "0.1.0",
})
expect((await invoke(["unknown"])).exitCode).toBe(64)
```

Add `doctor --package-only` coverage that does not require Codex or Kaku and verifies package payload hashes

- [ ] **Step 2: Write failing temporary HOME installation tests**

The test must

1. Build `riqor-0.1.0.tgz`
2. Create temporary `HOME`, `CODEX_HOME`, npm prefix, and empty working directory
3. Install the tarball globally into the temporary prefix
4. Run the installed `riqor version --json`
5. Run `riqor install --json` with fixture Codex and Kaku executables
6. Delete the temporary npm prefix and npm cache used to launch the installer
7. Run `$HOME/.local/bin/riqor version --json` and prove the persistent copy still works
8. Verify managed files, versioned data directory, `current` link, and manifest
9. Repeat with an existing legacy-compatible marketplace and Plugin fixture
10. Verify migration records the prior marketplace root, Plugin version, enabled state, and install source
11. Run install a second time and verify no duplicate shell blocks
12. Run uninstall twice and verify unrelated shell content remains and the prior Plugin state is restored

- [ ] **Step 3: Run tests and confirm packaged installation failures**

Run: `bun test packages/riqor/test/cli.test.ts packages/riqor/test/install-tarball.test.ts packages/riqor/test/rollback.test.ts`

Expected: FAIL because packaged command modules do not exist

- [ ] **Step 4: Implement typed command results**

```ts
export type CheckRecord = Readonly<{ id: string; ok: boolean; detail: string }>

export type InstallReport = Readonly<{
  ok: boolean
  version: string
  surfaces: readonly string[]
  manifestPath: string
  rollbackCommand: "riqor uninstall"
  checks: readonly CheckRecord[]
}>
```

Use equivalent immutable records for doctor, status, and uninstall

Add `classifyMarketplace(inventory: MarketplaceInventory, expectedRoot: string): MarketplaceState` and cover all four states before writing migration code

- [ ] **Step 5: Implement transactional install**

Install into a staging directory under `${XDG_STATE_HOME:-$HOME/.local/state}/riqor/install-staging-${crypto.randomUUID()}`

Copy the self-contained package payload into `${XDG_DATA_HOME:-$HOME/.local/share}/riqor/0.1.0` and atomically update `${XDG_DATA_HOME:-$HOME/.local/share}/riqor/current`

Create `~/.local/bin/riqor` as a shell shim that executes `node "${XDG_DATA_HOME:-$HOME/.local/share}/riqor/current/bin/riqor.mjs" "$@"`, then create `codex-harness` and `cxh` symlinks to that shim

Record every managed destination, previous `current` target, previous marketplace root, previous Plugin version and enabled state, and previous backup in `${XDG_CONFIG_HOME:-$HOME/.config}/riqor/install-manifest.json`

Classify an existing `codex-self-improvement-dev` marketplace as

- `current` when its canonical root equals the stable Riqor `current` runtime
- `legacy-compatible` when its marketplace manifest exposes only the expected `codex-self-improvement` Plugin from a readable local source
- `conflict` for every other mismatched source

Migrate `legacy-compatible` sources transactionally and fail without mutation on `conflict`

Required transaction order

```text
validate source package payload
copy versioned payload into staging
run package-only doctor against staging
classify and snapshot the existing marketplace and Plugin
remove the legacy-compatible Plugin and marketplace only inside the transaction
add the stable current marketplace
stage shell files and executable shims
stage Plugin installation from the versioned payload
atomically move payload into the data directory
atomically update current
commit shell files and shims
commit Plugin installation
write final manifest
run full doctor
```

Use the verified Codex CLI commands for migration

```bash
codex plugin remove codex-self-improvement@codex-self-improvement-dev
codex plugin marketplace remove codex-self-improvement-dev
codex plugin marketplace add "$RIQOR_STABLE_RUNTIME_ROOT"
codex plugin add codex-self-improvement@codex-self-improvement-dev
```

Rollback performs the inverse sequence with the recorded previous marketplace root and Plugin enabled state

On any failure after staging begins, restore the previous `current` target, marketplace source, Plugin version and enabled state, and recorded backups, then remove only the failed version and staged Riqor files

Do not retain a dependency on the npx cache, npm global prefix, Homebrew Cellar path, or original repository checkout

- [ ] **Step 6: Implement package-only and full doctor modes**

`riqor doctor --package-only --json` checks

- package version
- payload provenance
- required runtime files
- executable aliases
- supported platform

Full `riqor doctor --json` additionally checks

- Codex CLI availability and core doctor checks
- Plugin installed and enabled state
- shell environment files
- Kaku availability and warnings
- unrelated Codex and MCP observations under `externalIssues`

- [ ] **Step 7: Run tarball installation, cache-removal, update, and rollback tests**

Run: `bun run riqor:pack`

Run: `bun test packages/riqor/test`

Expected: all tests pass from the installed tarball without repository access

- [ ] **Step 8: Commit**

```bash
git add packages/riqor/src packages/riqor/test scripts/install-shell-integration.py scripts/uninstall-shell-integration.py
git commit -m "feat: install Riqor from packaged artifacts"
```

### Task 5: Replace the internal README with the public Riqor repository surface

**Files:**
- Modify: `README.md`
- Create: `LICENSE`
- Create: `SECURITY.md`
- Create: `CONTRIBUTING.md`
- Create: `CHANGELOG.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/integration_request.yml`
- Create: `.github/ISSUE_TEMPLATE/good_first_issue.yml`
- Create: `.github/pull_request_template.md`
- Modify: `packages/riqor/README.md`
- Test: `test/public-repository.test.ts`

**Interfaces:**
- Produces: public installation, usage, privacy, limitation, rollback, and contribution documentation
- Consumes: command surface and measured evidence from Tasks 2 through 4

- [ ] **Step 1: Write failing public repository assertions**

```ts
const readme = await readFile("README.md", "utf8")
expect(readme).toContain("# Riqor")
expect(readme).toContain("Your coding agent said it was done")
expect(readme).toContain("Riqor checks the evidence")
expect(readme).toContain("npx riqor install")
expect(readme).toContain("brew install imMamdouhaboammar/tap/riqor")
expect(readme).toContain("Hosted ChatGPT conversations do not execute local Riqor code")
expect(readme).not.toMatch(/deterministic AI|modifies the model|guarantees correctness/i)
```

Assert that `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, issue templates, and pull request template exist and contain no placeholders

- [ ] **Step 2: Run the documentation test and confirm failure**

Run: `bun test test/public-repository.test.ts`

Expected: FAIL because public repository files and Riqor README do not exist

- [ ] **Step 3: Write the marketing README with evidence-scoped claims**

Required opening structure

```md
# Riqor

**AI agents should prove the work**

Your coding agent said it was done

Riqor checks the evidence

Riqor adds local hooks, verification gates, reviewed workflows, and session continuity to Codex App, Codex CLI, and supported terminals
```

Include one terminal example

```text
$ riqor terminal status
verification-pending

$ npm test
42 tests passed

$ riqor terminal status
clear
```

Label the test count as an example unless regenerated from the current release gate

- [ ] **Step 4: Document exact boundaries**

State clearly

- Riqor does not modify model weights
- Riqor does not make model output deterministic
- Hosted ChatGPT conversations do not execute local Riqor code
- ChatGPT-controlled local terminals inherit Riqor only through the local shell and Codex environment
- Commands and source contents are not retained in Riqor state
- High-risk or durable learning actions require explicit approval

- [ ] **Step 5: Add repository governance files**

Use MIT license with copyright year 2026 and owner `Mamdouh Aboammar`

`SECURITY.md` must instruct reporters to use GitHub private vulnerability reporting and not public issues

`CONTRIBUTING.md` must require

```bash
bun install
bun test
bun run riqor:pack
bun run riqor:inspect -- packages/riqor/riqor-*.tgz
```

The pull request template must include tests, package inspection, privacy impact, rollback, and public claim evidence checkboxes

- [ ] **Step 6: Run documentation and link checks**

Run: `bun test test/public-repository.test.ts`

Run: `bunx markdownlint-cli2@0.18.1 README.md SECURITY.md CONTRIBUTING.md CHANGELOG.md packages/riqor/README.md`

Expected: PASS with no placeholder text and no unsupported claims

- [ ] **Step 7: Commit**

```bash
git add README.md LICENSE SECURITY.md CONTRIBUTING.md CHANGELOG.md .github packages/riqor/README.md test/public-repository.test.ts
git commit -m "docs: present Riqor as a public developer tool"
```

### Task 6: Add CI, release artifacts, checksums, and npm trusted publishing

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`
- Create: `scripts/verify-action-pins.ts`
- Create: `scripts/create-release-manifest.ts`
- Create: `scripts/verify-release-artifacts.ts`
- Modify: `package.json`
- Test: `test/github-workflows.test.ts`
- Test: `test/release-artifacts.test.ts`

**Interfaces:**
- Produces: `verifyActionPins(workflowPaths: string[]): Promise<void>`
- Produces: `createReleaseManifest(input: ReleaseManifestInput): Promise<ReleaseManifest>`
- Produces: `verifyReleaseArtifacts(directory: string): Promise<VerificationReport>`
- Consumes: npm tarball, Plugin ZIP, Git commit, tag, and package version

```ts
export type ReleaseManifestInput = Readonly<{
  version: string
  tag: string
  commit: string
  artifactPaths: readonly string[]
}>

export type VerificationReport = Readonly<{
  ok: boolean
  version: string
  checked: readonly string[]
  errors: readonly string[]
}>
```

- [ ] **Step 1: Write failing workflow security tests**

```ts
for (const workflow of [".github/workflows/ci.yml", ".github/workflows/release.yml"]) {
  const contents = await readFile(workflow, "utf8")
  expect(contents).not.toMatch(/uses:\s+[^\s]+@(v\d+|main|master)\b/)
  expect(contents).not.toContain("permissions: write-all")
}
```

Assert that release permissions are exactly

```yaml
permissions:
  contents: write
  id-token: write
```

Assert that the publish job has an environment named `npm` and runs only for tags matching `v*`

- [ ] **Step 2: Run tests and confirm missing workflow failures**

Run: `bun test test/github-workflows.test.ts test/release-artifacts.test.ts`

Expected: FAIL because workflows and release scripts do not exist

- [ ] **Step 3: Resolve and pin stable Action commits**

Use these commands for every Action tag and follow annotated tags when required

```bash
gh api repos/actions/checkout/git/ref/tags/v4 --jq .object.sha
gh api repos/actions/setup-node/git/ref/tags/v4 --jq .object.sha
gh api repos/oven-sh/setup-bun/git/ref/tags/v2 --jq .object.sha
```

Write only full 40-character commit SHAs into workflow `uses` entries and add comments with the human tag

`verify-action-pins.ts` must parse every workflow and reject non-SHA references

- [ ] **Step 4: Implement CI workflow gates**

CI runs on pull requests and pushes to `main`

Required commands

```bash
bun install --frozen-lockfile
bun test
bun run plugin:health
bun run skills:health
bun run riqor:pack
bun run riqor:inspect -- packages/riqor/riqor-*.tgz
bun test packages/riqor/test
bun run actions:verify
```

Use Node 22 and Bun 1.3.14 explicitly

- [ ] **Step 5: Implement deterministic release records**

`release-manifest.json` schema

```ts
export type ReleaseManifest = Readonly<{
  schemaVersion: 1
  product: "riqor"
  version: string
  tag: string
  commit: string
  artifacts: readonly {
    file: string
    sha256: string
    bytes: number
    mediaType: string
  }[]
}>
```

Write `SHA256SUMS` with sorted artifact names and lowercase digests

- [ ] **Step 6: Implement fail-closed release workflow**

Release workflow order

```text
verify tag equals package version
run full CI gates
build npm tarball
build Plugin ZIP
verify both artifacts
create release manifest and SHA256SUMS
create a draft GitHub release and upload artifacts
publish npm with provenance
publish the GitHub release only after npm succeeds
```

Use `npm publish packages/riqor/riqor-0.1.0.tgz --provenance --access public`

When `riqor@0.1.0` already exists during an authorized rerun, compare registry integrity with the local tarball and skip publishing only when they match exactly

Support trusted publishing without `NODE_AUTH_TOKEN` and a one-time bootstrap `NPM_TOKEN` secret for the first release when the package cannot yet have a trusted publisher

If npm publishing fails, keep the GitHub release as a draft and do not expose partial release notes or assets publicly

- [ ] **Step 7: Run workflow and artifact tests**

Run: `bun test test/github-workflows.test.ts test/release-artifacts.test.ts`

Run: `bun run actions:verify`

Run: `bun run release:dry-run`

Expected: generated manifest, checksums, npm tarball, and Plugin ZIP all report the same version and commit

- [ ] **Step 8: Commit**

```bash
git add .github/workflows scripts/verify-action-pins.ts scripts/create-release-manifest.ts scripts/verify-release-artifacts.ts package.json test/github-workflows.test.ts test/release-artifacts.test.ts
git commit -m "ci: add Riqor release gates"
```

### Task 7: Generate and verify the Homebrew Formula

**Files:**
- Create: `scripts/generate-homebrew-formula.ts`
- Create: `scripts/build-homebrew-archive.ts`
- Create: `scripts/test-homebrew-formula.sh`
- Create: `Formula/riqor.rb`
- Create: `test/homebrew-formula.test.ts`
- Modify: `.github/workflows/release.yml`
- Modify: `scripts/create-release-manifest.ts`
- Modify: `scripts/verify-release-artifacts.ts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces: `renderRiqorFormula(input: FormulaInput): string`
- Produces: `FormulaInput` with `version`, `url`, `sha256`, and `nodeFormula`
- Consumes: dedicated GitHub release archive `riqor-0.1.0-homebrew.tar.gz` and verified SHA-256

```ts
export type FormulaInput = Readonly<{
  version: string
  url: string
  sha256: string
  nodeFormula: "node@22"
  allowLocalUrl?: boolean
}>
```

- [ ] **Step 1: Write the failing Formula renderer tests**

```ts
const formula = renderRiqorFormula({
  version: "0.1.0",
  url: "https://github.com/imMamdouhaboammar/riqor/releases/download/v0.1.0/riqor-0.1.0-homebrew.tar.gz",
  sha256: "a".repeat(64),
  nodeFormula: "node@22",
})
expect(formula).toContain('class Riqor < Formula')
expect(formula).toContain('depends_on "node@22"')
expect(formula).toContain('bin.install_symlink libexec/"bin/riqor.mjs" => "riqor"')
expect(formula).toContain('system bin/"riqor", "doctor", "--package-only", "--json"')
expect(formula).not.toContain("shell:install")
```

- [ ] **Step 2: Run the test and confirm the missing renderer failure**

Run: `bun test test/homebrew-formula.test.ts`

Expected: FAIL because the Formula renderer does not exist

- [ ] **Step 3: Implement exact Formula behavior**

The generated Formula must

```ts
return `class Riqor < Formula
  desc "Evidence gates and session continuity for AI coding agents"
  homepage "https://github.com/imMamdouhaboammar/riqor"
  url "${input.url}"
  sha256 "${input.sha256}"
  license "MIT"
  version "${input.version}"
  depends_on "${input.nodeFormula}"

  def install
    libexec.install Dir["*"]
    bin.install_symlink libexec/"bin/riqor.mjs" => "riqor"
    bin.install_symlink libexec/"bin/riqor.mjs" => "codex-harness"
    bin.install_symlink libexec/"bin/riqor.mjs" => "cxh"
  end

  test do
    system bin/"riqor", "version", "--json"
    system bin/"riqor", "doctor", "--package-only", "--json"
  end
end
`
```

The generator must reject non-HTTPS URLs, non-semver versions, and digests that are not 64 lowercase hexadecimal characters

Build `dist/riqor-0.1.0-homebrew.tar.gz` from the contents of `packages/riqor` after `riqor:build`, excluding npm tarballs and package-local tests

The archive root must contain `bin`, `dist`, `runtime`, `package.json`, `README.md`, and `LICENSE` directly without the npm `package/` wrapper directory

Extend the release workflow, release manifest, and checksums to include this dedicated archive

- [ ] **Step 4: Add local Homebrew verification scripts**

Add root scripts

```json
"brew:archive": "bun run scripts/build-homebrew-archive.ts",
"brew:generate": "bun run scripts/generate-homebrew-formula.ts",
"brew:style": "brew style Formula/riqor.rb && ruby -c Formula/riqor.rb",
"brew:audit": "brew audit --strict Formula/riqor.rb",
"brew:test": "bash scripts/test-homebrew-formula.sh"
```

`scripts/test-homebrew-formula.sh` must build the deterministic archive, generate `work/homebrew/riqor.rb` with an exact `file://` URL and `allowLocalUrl: true`, install that temporary Formula, run its test block, and uninstall it in `finally`

Production Formula generation keeps `allowLocalUrl` false and rejects non-HTTPS URLs

- [ ] **Step 5: Verify Formula does not mutate user configuration**

Before and after `brew install`, hash

```text
~/.zshenv
~/.zshrc
~/.config/riqor
~/.config/kaku
~/.codex/config.toml
```

Expected: no file changes until `riqor install` is run explicitly

- [ ] **Step 6: Run Formula tests**

Run: `bun test test/homebrew-formula.test.ts`

Run: `bun run brew:style`

Run: `bun run brew:audit`

Run: `bun run brew:test`

Expected: Formula installs all three executable names, package-only doctor passes, and uninstall removes Homebrew files

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-homebrew-formula.ts scripts/build-homebrew-archive.ts scripts/test-homebrew-formula.sh Formula/riqor.rb .github/workflows/release.yml scripts/create-release-manifest.ts scripts/verify-release-artifacts.ts test/homebrew-formula.test.ts package.json README.md
git commit -m "feat: add Riqor Homebrew Formula"
```

### Task 8: Add ownership preflight and create the public GitHub repositories

**Files:**
- Create: `scripts/release-preflight.ts`
- Create: `test/release-preflight.test.ts`
- Modify: `package.json`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces: `runReleasePreflight(options: PreflightOptions): Promise<PreflightReport>`
- Produces: resource states `available`, `owned`, `conflict`, or `unreachable`
- Consumes: GitHub CLI authentication, npm authentication, desired repository names, package name, and Homebrew tap name

```ts
export type ResourceState = "available" | "owned" | "conflict" | "unreachable"
export type PreflightOptions = Readonly<{ repositoryRoot?: string; expectedOwner: "imMamdouhaboammar" }>
export type PreflightReport = Readonly<{
  ok: boolean
  githubUser: string | null
  npmUser: string | null
  resources: Readonly<Record<"githubRepo" | "homebrewTap" | "npmPackage", ResourceState>>
  errors: readonly string[]
}>
```

- [ ] **Step 1: Write failing preflight classification tests**

```ts
expect(classifyGitHub({ exitCode: 1, stderr: "Could not resolve to a Repository" })).toBe("available")
expect(classifyGitHub({ exitCode: 0, owner: "imMamdouhaboammar" })).toBe("owned")
expect(classifyNpm({ status: 404 })).toBe("available")
expect(classifyNpm({ status: 200, maintainers: ["another-user"] })).toBe("conflict")
```

Add a test that network or authentication failures return `unreachable` rather than `available`

- [ ] **Step 2: Run the test and confirm missing preflight failure**

Run: `bun test test/release-preflight.test.ts`

Expected: FAIL because the preflight module does not exist

- [ ] **Step 3: Implement evidence-based resource checks**

Check GitHub identity

```bash
gh auth status
gh api user --jq .login
gh repo view imMamdouhaboammar/riqor --json nameWithOwner,visibility,url
gh repo view imMamdouhaboammar/homebrew-tap --json nameWithOwner,visibility,url
```

Check npm identity without treating connectivity errors as availability

```bash
npm whoami
npm view riqor name version maintainers --json
```

Check local requirements

```bash
git status --porcelain
git remote -v
bun --version
node --version
npm --version
gh --version
brew --version
codex --version
```

The report must print no token values and must redact registry or GitHub authentication output

- [ ] **Step 4: Add a fail-closed public resource command**

Add root script

```json
"release:preflight": "bun run scripts/release-preflight.ts --json"
```

Exit code rules

```text
0  every resource is available or owned by imMamdouhaboammar
2  ownership conflict
3  authentication or network state cannot be verified
4  repository or artifact state is dirty or inconsistent
```

- [ ] **Step 5: Run the real preflight and archive the bounded report**

Run: `bun run release:preflight > work/release-preflight.json`

Expected: report identifies the authenticated GitHub and npm users, classifies both repositories and `riqor`, and contains no credential values

- [ ] **Step 6: Commit preflight tooling before any public push**

```bash
git add scripts/release-preflight.ts test/release-preflight.test.ts package.json CHANGELOG.md
git commit -m "chore: add Riqor release preflight"
```

- [ ] **Step 7: Create or reuse the public repositories**

When `imMamdouhaboammar/riqor` is `available`

```bash
gh repo create imMamdouhaboammar/riqor --public --source=. --remote=origin --description "Evidence gates and session continuity for AI coding agents"
```

When it is `owned`, verify the existing remote matches before setting `origin`

```bash
git remote add origin git@github.com:imMamdouhaboammar/riqor.git
```

Create `imMamdouhaboammar/homebrew-tap` only when absent

```bash
gh repo create imMamdouhaboammar/homebrew-tap --public --description "Homebrew formulas by Mamdouh Aboammar"
```

Do not overwrite an existing repository with unrelated history

- [ ] **Step 8: Configure repository metadata**

Apply description, homepage, and topics

```bash
gh repo edit imMamdouhaboammar/riqor \
  --description "Evidence gates and session continuity for AI coding agents" \
  --homepage "https://www.npmjs.com/package/riqor" \
  --add-topic ai-agents,coding-agents,codex,developer-tools,agent-hooks,verification,terminal
```

Enable issues and private vulnerability reporting through GitHub settings or API

- [ ] **Step 9: Push the committed and tested history**

Run: `git push -u origin main`

Verify

```bash
gh repo view imMamdouhaboammar/riqor --json defaultBranchRef,visibility,url
gh run list --repo imMamdouhaboammar/riqor --limit 5
```

Expected: public repository exists, `main` is the default branch, and CI starts on the pushed commit

### Task 9: Build and review the release candidate before public publishing

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `packages/riqor/package.json`
- Modify: `plugins/codex-self-improvement/.codex-plugin/plugin.json`
- Create: `docs/releases/0.1.0.md`
- Create: `test/version-alignment.test.ts`

**Interfaces:**
- Produces: one version-aligned release candidate for npm, Plugin ZIP, Git tag, GitHub release, and Homebrew Formula
- Consumes: all gates and artifacts from Tasks 1 through 8

- [ ] **Step 1: Write failing version-alignment tests**

```ts
const npmPackage = JSON.parse(await readFile("packages/riqor/package.json", "utf8"))
const releaseNotes = await readFile("docs/releases/0.1.0.md", "utf8")
const formula = await readFile("Formula/riqor.rb", "utf8")
const manifest = JSON.parse(await readFile("dist/release-manifest.json", "utf8"))

expect(npmPackage.version).toBe("0.1.0")
expect(releaseNotes).toContain("v0.1.0")
expect(formula).toContain('version "0.1.0"')
expect(manifest.version).toBe("0.1.0")
expect(manifest.artifacts.every((artifact: { file: string }) => artifact.file.includes("0.1.0"))).toBe(true)
```

The test must parse generated `release-manifest.json` and verify every artifact name contains the same public version

- [ ] **Step 2: Run version tests and confirm current mismatch**

Run: `bun test test/version-alignment.test.ts`

Expected: FAIL until public version records and release notes align

- [ ] **Step 3: Set the first public version and release notes**

Use public version `0.1.0`

Keep the internal Plugin cachebuster version independent but record it in release metadata

Release notes must include

- npm and Homebrew installation commands
- supported platforms and shells
- exact Plugin selector retained for compatibility
- privacy boundary
- verification commands and results generated by the release gate
- model-backed smoke limitation when quota still blocks the model turn
- uninstall and rollback commands

- [ ] **Step 4: Run complete local release gates**

Run exactly

```bash
git diff --check
bun install --frozen-lockfile
bun test
bun run plugin:health
bun run skills:health
bun run riqor:pack
bun run riqor:inspect -- packages/riqor/riqor-0.1.0.tgz
bun test packages/riqor/test
bun run plugin:package
bun run plugin:smoke
bun run brew:archive
bun run brew:generate
bun run brew:style
bun run brew:audit
bun run brew:test
bun run release:dry-run
```

Expected: all local checks pass, with model smoke allowed to report `quota-blocked` only when hook execution is independently verified

- [ ] **Step 5: Run independent review gates**

Run CodeRabbit on the complete release diff

```bash
coderabbit review --agent -t uncommitted --base main
```

Run a repository security scan using the installed Codex Security workflow

Reject or fix every validated major finding before continuing

Record rate limits or unavailable external reviewers honestly rather than treating them as successful review

- [ ] **Step 6: Inspect artifacts manually**

Run

```bash
tar -tzf packages/riqor/riqor-0.1.0.tgz
tar -tzf dist/riqor-0.1.0-homebrew.tar.gz
unzip -Z1 dist/riqor-plugin-*.zip
shasum -a 256 packages/riqor/riqor-0.1.0.tgz dist/riqor-0.1.0-homebrew.tar.gz dist/riqor-plugin-*.zip
```

Verify no `.DS_Store`, `auth.json`, `.env`, credentials, local state, `work/`, `fixtures/`, or absolute user paths appear

- [ ] **Step 7: Commit the release candidate**

```bash
git add CHANGELOG.md packages/riqor/package.json plugins/codex-self-improvement/.codex-plugin/plugin.json docs/releases/0.1.0.md test/version-alignment.test.ts
git commit -m "chore: prepare Riqor 0.1.0"
```

- [ ] **Step 8: Tag only the verified commit**

```bash
git tag -s v0.1.0 -m "Riqor 0.1.0"
git show --verify-signatures v0.1.0
```

When signing is unavailable, stop and configure a verified Git signing identity rather than creating an unsigned release tag

### Task 10: Publish GitHub, npm, and Homebrew, then verify clean installations

**Files:**
- Modify: `Formula/riqor.rb`
- Modify: `CHANGELOG.md`
- Modify: `docs/releases/0.1.0.md`
- Create in tap repository: `Formula/riqor.rb`
- Create: `docs/releases/0.1.0-verification.json`

**Interfaces:**
- Produces: public GitHub release `v0.1.0`, npm package `riqor@0.1.0`, and Homebrew Formula `riqor`
- Consumes: signed tag, verified release manifest, npm authentication or trusted publisher, GitHub authentication, and owned Homebrew tap

- [ ] **Step 1: Push the release commit and signed tag**

```bash
git push origin main
git push origin v0.1.0
```

Wait for GitHub CI and inspect every job result through `gh run view`

Do not publish npm or update Homebrew while any required check is pending or failed

- [ ] **Step 2: Watch the release workflow and require a successful exit**

```bash
RUN_ID="$(gh run list --repo imMamdouhaboammar/riqor --workflow release.yml --limit 1 --json databaseId,headBranch --jq '.[] | select(.headBranch == "v0.1.0") | .databaseId')"
test -n "$RUN_ID"
gh run watch "$RUN_ID" --repo imMamdouhaboammar/riqor --exit-status
```

The workflow owns draft release creation, artifact upload, npm publishing, and final release publication

Do not create a second release or publish npm manually after a successful workflow

- [ ] **Step 3: Verify the GitHub release and npm registry independently**

```bash
gh release view v0.1.0 --repo imMamdouhaboammar/riqor --json isDraft,isPrerelease,tagName,assets,url
npm view riqor@0.1.0 name version dist.tarball dist.integrity maintainers --json
npx --yes riqor@0.1.0 version --json
```

Expected: the release is public rather than draft, all five release assets are present, and npm reports `riqor@0.1.0`

Download every GitHub asset into a temporary directory and compare its size and SHA-256 with `release-manifest.json`

When the first release used the scoped `NPM_TOKEN` bootstrap secret, configure npm trusted publishing with these exact values before deleting the secret

```text
repository  imMamdouhaboammar/riqor
workflow    release.yml
environment npm
```

Then remove the bootstrap secret

```bash
gh secret delete NPM_TOKEN --repo imMamdouhaboammar/riqor
```

Never print npm tokens or write them into repository files

- [ ] **Step 4: Update and push the Homebrew tap**

Download the GitHub release tarball and compute its digest independently

```bash
curl -L --fail --output /tmp/riqor-0.1.0-homebrew.tar.gz \
  https://github.com/imMamdouhaboammar/riqor/releases/download/v0.1.0/riqor-0.1.0-homebrew.tar.gz
shasum -a 256 /tmp/riqor-0.1.0-homebrew.tar.gz
```

Regenerate `Formula/riqor.rb` with the verified URL and digest

Clone or open `imMamdouhaboammar/homebrew-tap`, copy the Formula, run `brew style` and `brew audit`, commit, and push

```bash
git commit -m "riqor 0.1.0"
git push origin main
```

- [ ] **Step 5: Verify npx from a clean temporary environment**

```bash
TEST_HOME="$(mktemp -d)"
env HOME="$TEST_HOME" XDG_CONFIG_HOME="$TEST_HOME/.config" XDG_STATE_HOME="$TEST_HOME/.state" \
  npx --yes riqor@0.1.0 version --json
env HOME="$TEST_HOME" XDG_CONFIG_HOME="$TEST_HOME/.config" XDG_STATE_HOME="$TEST_HOME/.state" \
  npx --yes riqor@0.1.0 doctor --package-only --json
```

Expected: version and package-only doctor pass without repository checkout or access to the real user home

- [ ] **Step 6: Verify global npm installation**

Use a temporary npm prefix and confirm all binaries

```bash
PREFIX="$(mktemp -d)"
npm install --global --prefix "$PREFIX" riqor@0.1.0
"$PREFIX/bin/riqor" version --json
"$PREFIX/bin/codex-harness" version --json
"$PREFIX/bin/cxh" version --json
```

Expected: all commands report `0.1.0` and the same Plugin payload version

- [ ] **Step 7: Verify Homebrew from the public tap**

```bash
brew uninstall riqor 2>/dev/null || true
brew untap imMamdouhaboammar/tap 2>/dev/null || true
brew tap imMamdouhaboammar/tap
brew install riqor
riqor version --json
riqor doctor --package-only --json
brew test riqor
brew uninstall riqor
```

Expected: install and test pass, and no shell or Codex user configuration changes occur before `riqor install`

- [ ] **Step 8: Verify the full local installation through one distribution channel**

Install through either npm or Homebrew, then run

```bash
riqor install
riqor doctor --json
codex plugin list --json
zsh -lic 'riqor status --json'
zsh -lic 'TERM_PROGRAM=kaku source ~/.config/kaku/zsh/plugins/kaku-shell-loader.zsh; riqor terminal status --json'
riqor uninstall
```

Expected: Codex App, Codex CLI, and ChatGPT bundled Codex see the same enabled Plugin, Kaku reports no warnings, and uninstall restores managed shell files

- [ ] **Step 9: Save bounded public verification evidence**

Write `docs/releases/0.1.0-verification.json` with

```json
{
  "schemaVersion": 1,
  "version": "0.1.0",
  "githubRelease": "verified",
  "npm": "verified",
  "homebrew": "verified",
  "npxCleanHome": "passed",
  "npmGlobal": "passed",
  "homebrewInstall": "passed",
  "fullInstall": "passed"
}
```

Include artifact digests and public URLs, but exclude local paths, tokens, command output, and user identifiers beyond the public repository owner

- [ ] **Step 10: Commit verification records and final documentation updates**

```bash
git add Formula/riqor.rb CHANGELOG.md docs/releases/0.1.0.md docs/releases/0.1.0-verification.json
git commit -m "docs: record Riqor 0.1.0 distribution verification"
git push origin main
```

Expected: public repository is clean, all documented channels resolve to `0.1.0`, and no release artifact differs from its recorded digest
