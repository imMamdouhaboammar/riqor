# Riqor Marketplace Agent Skills Design

## Goal

Make the Riqor marketplace plugin expose the existing 101 specialist roles as bundled Skills that ChatGPT and Codex can discover and invoke, while preserving the existing 101 native Codex agents. Each native agent must require its paired Skill before doing work.

## Product model

Riqor has two representations of the same specialist catalog:

- Native Codex agent: execution identity for multi-agent Codex workflows
- Bundled plugin Skill: portable capability for ChatGPT, ChatGPT Work, Codex, and other plugin surfaces that understand Skills

The Skill is the portable public representation. The native agent is the Codex-specific execution representation. They share one slug and one canonical source agent.

This feature does not convert Skills into MCP tools and does not add an MCP server. The user experience target is similar to an installed capability pack such as Superpowers: install one Riqor plugin and gain a catalog of specialist Skills.

## Source of truth and generation

The 101 files under `.codex/agents/*.toml` remain the canonical specialist source.

A deterministic generator creates and maintains these plugin artifacts:

1. `plugins/riqor/.codex/agents/<slug>.toml`
2. `plugins/riqor/skills/<slug>/SKILL.md`
3. `plugins/riqor/skills/<slug>/references/agent-instructions.md`
4. `plugins/riqor/skills/<slug>/agents/openai.yaml`
5. `plugins/riqor/agent-skill-map.json`
6. `plugins/riqor/skills/riqor-core/references/specialists.md`

The generator manages only directories whose slug matches a canonical source agent. The existing Riqor workflow Skills remain hand-maintained.

## Skill shape

Each paired Skill uses progressive disclosure:

- `SKILL.md` contains compact trigger metadata, the mandatory operating contract, and instructions to read the specialist reference
- `references/agent-instructions.md` carries the detailed instructions extracted from the canonical source agent
- `agents/openai.yaml` provides human-facing display metadata and permits implicit invocation

Descriptions must remain compact because large Skill catalogs compete for the initial discovery budget. The generated `riqor-core` specialist index provides a complete catalog for routing when a user invokes Riqor generally.

## Mandatory native-agent pairing

The generated plugin copy of every native agent appends a deterministic mandatory pairing block to `developer_instructions`:

- load the paired Skill before task execution
- treat the paired Skill as required, not optional guidance
- do not silently substitute another Skill
- additional relevant Skills may be loaded after the paired Skill
- if the paired Skill cannot be loaded, report a pairing failure instead of silently continuing

The canonical source agent remains free of generated boilerplate. The plugin-native agent is derived from it.

The existing `SubagentStart` hook remains a secondary enforcement surface. Runtime identity-specific injection may only be added if a real Codex hook payload test proves that a stable agent identifier is supplied. No identity field will be invented or assumed.

## Mapping and drift protection

`agent-skill-map.json` records, for every slug:

- agent slug and human display name
- canonical source agent path
- generated plugin agent path
- generated Skill and reference paths
- SHA-256 hashes for canonical instructions and generated specialist reference

Health and release checks enforce these invariants:

- exactly 101 canonical source agents
- exactly 101 paired plugin Skills
- exactly 101 mapping records
- exactly 101 generated native plugin agents
- every paired Skill has valid frontmatter and OpenAI UI metadata
- every native agent contains the correct mandatory pairing contract
- no orphan agent or paired Skill
- no stale generated content or hash mismatch
- generated files are deterministic

The plugin will contain 112 Skills after generation: 101 paired specialist Skills plus the existing 11 Riqor workflow Skills.

## Marketplace and runtime packaging

The plugin manifest continues to expose `skills: ./skills/`. The plugin ZIP must contain all 101 paired Skills at archive root under `skills/` so Marketplace installation exposes them directly to ChatGPT/Codex.

The npm runtime continues to package the same plugin directory, so npm and Marketplace artifacts share the same specialist catalog. Native Codex profile installation remains supported.

`riqor codex` continues to select the managed native profile when available. A native agent that cannot access its paired Skill must surface that condition rather than pretend the pairing succeeded.

## Legal and support URLs

Add public GitHub-hosted documents:

- `PRIVACY.md`
- `TERMS.md`
- `SUPPORT.md`

Use these stable URLs:

- Privacy Policy: `https://github.com/imMamdouhaboammar/riqor/blob/main/PRIVACY.md`
- Terms of Service: `https://github.com/imMamdouhaboammar/riqor/blob/main/TERMS.md`
- Customer Support: `https://github.com/imMamdouhaboammar/riqor/blob/main/SUPPORT.md`

Set the documented plugin manifest fields `interface.privacyPolicyURL` and `interface.termsOfServiceURL`. Customer Support remains a public submission/support URL unless the current official manifest schema documents a support field.

The documents must describe the actual open-source developer tool behavior and must not invent SaaS data practices, guarantees, or legal claims.

## Security boundaries

The generator must not copy credentials, local paths, transcripts, prompts, runtime state, or environment values into Skills. Only committed canonical agent definitions are sources.

The existing credential-shaped filename gate remains strict. Any exception required by the legitimate `security-secrets-credential-engineer` slug must be exact and limited to generated files for that known role.

No generated Skill may add apps, MCP server configuration, authentication secrets, or executable dependencies.

## Verification

TDD coverage must include:

- deterministic agent-to-Skill generation
- stale output detection
- one-to-one count and mapping invariants
- mandatory contract validation
- valid Skill frontmatter and `agents/openai.yaml`
- specialist index coverage
- Marketplace ZIP contains 101 paired Skills and 101 native agents
- npm runtime contains the same catalog
- legal files and manifest URLs
- credential boundary regression
- existing native-agent profile behavior

The final release gate includes the full repository test suite, plugin health, Skill health, packaged runtime tests, deterministic plugin packaging, release preflight, and remote artifact inspection.

## Release policy

This is a patch release because it expands packaged capability without changing the stable CLI contract. Target version: `0.2.4`.

npm publishing remains local-terminal-only. GitHub Actions must not publish npm. After the local npm artifact is published and verified, push the release commit, create `v0.2.4`, let the release workflow compare the registry artifact byte-for-byte, and verify the GitHub Release assets remotely.
