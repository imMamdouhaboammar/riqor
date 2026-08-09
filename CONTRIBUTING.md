# Contributing to Riqor

Riqor changes can affect local shell files, Codex lifecycle behavior, verification state, package installation, and release artifacts. Contributions should keep those boundaries explicit and include evidence for the changed area.

## Before You Start

Read the relevant public guide:

- [Getting Started](docs/GETTING_STARTED.md)
- [CLI Reference](docs/CLI_REFERENCE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security Model](docs/SECURITY_MODEL.md)
- [Development Backlog](BACKLOG.md)
- [Backlog Operating Guide](docs/backlog/README.md)

Search existing issues, pull requests, and backlog records before opening a new change.

For a suspected vulnerability, do not open a public issue. Use [GitHub Private Vulnerability Reporting](https://github.com/imMamdouhaboammar/riqor/security/advisories/new).

## Development Environment

The repository CI uses:

- Ubuntu
- Node.js 22
- Bun 1.3.14
- zsh

Install dependencies:

```bash
bun install --frozen-lockfile
```

Run the full test suite:

```bash
bun test
```

## Repository Areas

| Area | Path |
| --- | --- |
| Packaged CLI | `packages/riqor/` |
| Harness CLI and Codex wrapper | `src/harness-cli.ts` |
| Terminal verification state | `src/terminal-runtime.ts` |
| Codex plugin | `plugins/riqor/` |
| Shell and package scripts | `scripts/` |
| Main integration tests | `test/` |
| Packaged CLI tests | `packages/riqor/test/` |
| Development backlog | `backlog/`, `BACKLOG.md`, `docs/backlog/` |
| Public documentation | `README.md`, `docs/`, package README files |
| CI and release workflows | `.github/workflows/` |

## Backlog Workflow

The YAML records under `backlog/initiatives/` and `backlog/items/` are the development source of truth. `BACKLOG.md` and `docs/backlog/CURRENT.md` are generated views. GitHub Issues and pull requests are execution mirrors.

Before starting a backlog item:

1. Confirm the item is `ready` or already `in-progress`
2. Confirm its dependencies and WIP limits
3. Confirm that Riqor owns the behavior rather than `agent-kernel`, `delegate-team`, `dokion`, Codex Security, or Creative
4. Create or update the GitHub execution mirror
5. Set `github.pr` when implementation starts
6. Run `bun run backlog:check`

A backlog item cannot move to `done` without current-head acceptance, applicable repository gates, resolved reviews, synchronized documentation, completion evidence, and regenerated views.

Use the Issue Forms for initiative, item, and phase mirrors. Do not treat a closed GitHub issue as authoritative when the repository record is still open.

## Change Workflow

1. Create a focused branch from the current `main`
2. Write or update tests that define the expected behavior
3. Make the smallest implementation change that satisfies the contract
4. Run focused tests while developing
5. Run the required verification set before opening a pull request
6. Review the complete diff for unrelated changes, local paths, secrets, generated files, and stale documentation
7. Update the related backlog record and regenerate the backlog views with `bun run backlog:sync` when the change belongs to a tracked item
8. Open a pull request with scope, behavior, risks, and exact verification evidence

## Required Verification

Run the complete repository gate for changes that affect runtime behavior, installation, packaging, hooks, or workflows:

```bash
bun test
bun run plugin:health
bun run skills:health
bun run riqor:pack
bun run riqor:inspect -- packages/riqor/riqor-*.tgz
bun run riqor:test
bun run actions:verify
```

### Focused Checks by Area

| Changed area | Minimum focused checks before the full gate |
| --- | --- |
| Activator CLI | `bun test test/codex-activator-cli.test.ts packages/riqor/test/cli.test.ts` |
| Activator state or hooks | `bun test test/plugin-activator.test.ts test/plugin-hooks.test.ts` |
| Terminal runtime | `bun test test/terminal-runtime.test.ts test/harness-cli.test.ts` |
| Backlog records or governance | `bun run backlog:check` and `bun test test/backlog-schema.test.ts test/backlog-integrity.test.ts` |
| Packaged CLI | `bun run riqor:test` |
| Package build | `bun run riqor:pack` and `bun run riqor:inspect -- packages/riqor/riqor-*.tgz` |
| Homebrew | `bun run brew:style`, `bun run brew:audit`, and `bun run brew:test` when Homebrew is available |
| GitHub Actions | `bun run actions:verify` |
| Documentation only | Review rendered Markdown, links, commands, and claims against current source |

Do not weaken or remove a test only to make a failing change pass. When a test contract is wrong, explain why it is wrong and replace it with a more accurate contract.

## Security Expectations

Changes that touch environment variables, filesystem paths, subprocesses, hooks, state, locks, symlinks, installers, or release workflows require explicit security review.

Check at least:

- path traversal and symlink behavior
- file and directory permissions
- atomic write behavior
- lock acquisition and stale lock handling
- state size and count bounds
- malformed input handling
- subprocess argument forwarding
- shell invocation
- environment inheritance
- cleanup on lifecycle end
- failure-open and failure-closed decisions
- secret and local path exposure

Riqor should not retain prompt text, transcript text, source contents, commands, or credentials in activator state.

Backlog records may contain repository acceptance commands, but must not contain command output, prompts, transcripts, credentials, tokens, environment values, source contents, or private local paths.

## Code Conventions

- TypeScript files use kebab-case filenames where the existing area follows that pattern
- Functions and variables use camelCase
- Types and classes use PascalCase
- Prefer named exports
- Use direct subprocess argument arrays
- Avoid shell execution when a direct process call is available
- Keep local state formats versioned
- Add bounds before accepting user or environment timing values
- Preserve existing approval and managed-session boundaries

Follow the patterns already used in the file being changed rather than introducing a second style.

## Commit Messages

Use Conventional Commits with a focused subject:

```text
feat: add managed checkpoint state
fix: reject inherited activator scope
test: cover stale activator locks
docs: clarify watchdog behavior
chore: update pinned action digest
```

Keep unrelated changes in separate commits or separate pull requests.

## Pull Request Content

A useful pull request description includes:

- scope
- user-visible behavior
- technical approach
- security or compatibility considerations
- files or components affected
- exact tests and commands run
- related backlog item and source record
- known limitations
- screenshots only when the change has visible output

Use the repository pull request template and keep every checked item supported by current-head evidence.

## Documentation Standards

Documentation changes must:

- use `riqor` as the primary command name
- keep `codex-harness` and `cxh` described as compatibility aliases
- distinguish hosted ChatGPT conversations from local terminal control
- distinguish the activator watchdog from a process timeout
- state that the activator applies only to sessions started through `riqor codex --activator`
- keep timing defaults and bounds aligned with source
- avoid claims that Riqor proves all semantic correctness
- link detailed material instead of duplicating long sections across every file
- use commands that exist in the current CLI

## Release-Sensitive Changes

Do not publish a package or create a tag from a feature branch.

Before a release, verify:

- package and plugin versions are aligned with the intended release
- package inspection passes
- release artifacts match the manifest
- GitHub Actions remain pinned according to repository policy
- npm provenance remains enabled
- release notes describe observable changes and boundaries
- committed backlog items for the release are done with evidence
- generated backlog views are current

## Getting Help

Open a focused issue with a reproduction, environment details, expected behavior, observed behavior, and relevant redacted diagnostics.
