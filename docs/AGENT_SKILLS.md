# Riqor Agent Skills Pack

Riqor ships a canonical set of operational skills for AI coding agents that work with Riqor itself or use Riqor to manage coding sessions

The repository source is `skills/riqor-pack/`. The npm package includes the same files under `runtime/skills/riqor-pack/`, so the guidance travels with the installed version

## Included skills

| Skill | Use it for |
| --- | --- |
| `riqor-core` | Installation boundaries, runtime identity, and safe default operation |
| `riqor-evidence` | Repository runs, evidence state, trace review, and completion gates |
| `riqor-managed-codex` | `riqor codex`, activator timing, watchdog behavior, and session isolation |
| `riqor-diagnostics` | Package, shell, plugin, provenance, and state troubleshooting |
| `riqor-security` | Filesystem, process, state, credential, and release-integrity changes |
| `riqor-release` | Version alignment, release gates, npm publishing, GitHub Releases, and post-publish verification |

Each skill has bounded scope and can be loaded independently. Agents should select the narrowest applicable skill rather than injecting the whole pack into every task

## Repository use

Agent runtimes that support the Agent Skills `SKILL.md` convention can read the skill directory directly from `skills/riqor-pack/<skill>/SKILL.md`

Riqor also keeps repository-facing companion instructions under `.agents/skills/riqor/` and `.claude/skills/riqor/` for tools that discover skills from those locations

## Installed package use

A normal `riqor install` places the versioned npm payload under the Riqor data directory. The Skills Pack is inside that payload at

```text
runtime/skills/riqor-pack/
```

The exact versioned install root is recorded in Riqor's install manifest. Agents should resolve the active Riqor payload rather than assuming a fixed package version in a path

## Safety contract

The Skills Pack does not grant permissions and does not replace repository instructions. It describes how an agent should operate Riqor while preserving these boundaries

- no raw prompts, transcripts, source contents, command output, environment values, or credentials in Riqor state
- no replacement of unknown executables, plugin directories, or shell content
- no activator attachment to unmanaged sessions
- no completion claim without fresh verification after the last relevant mutation
- no release claim without package inspection and registry verification

## Updating the pack

Changes to a skill must update the canonical file under `skills/riqor-pack/` first. Run

```bash
bun test test/riqor-skills-pack.test.ts
bun run riqor:build
bun run riqor:pack
bun run riqor:inspect -- packages/riqor/riqor-*.tgz
```

The package build copies the canonical pack into the runtime and records it in `runtime/provenance.json`
