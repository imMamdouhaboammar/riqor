# Plugin Architecture Decisions

Choose the smallest architecture that can deliver the requested user outcome. Do not add MCP, apps, hooks, or UI because another plugin uses them.

## Skills-only

Use when the plugin's value is reusable instructions, workflows, references, deterministic local scripts, or host-native tool use without a plugin-owned remote service.

Typical root:

```text
.codex-plugin/plugin.json
skills/<skill>/SKILL.md
skills/<skill>/references/...
assets/...
```

Keep the manifest `skills` path explicit. Public directory URL fields are not all mandatory in the shared skills-only validator, but stable privacy, terms, support, and website URLs are a strong default for public distribution.

## MCP-backed

Use when the plugin needs a remote/private data source, account-specific action, external service, hosted business logic, or tool endpoint that must execute outside ordinary Skill instructions.

MCP-backed public submission has stronger metadata and review requirements. Website, privacy policy, terms, and support URLs are required. Authentication and UI remain properties of the MCP integration. Verify the current MCP review requirements before publication.

Do not store credentials in `.mcp.json`, Skill files, examples, CI logs, or release artifacts. Use environment/config references supported by the target host and repository policy.

## Hybrid

Use when both reusable instruction workflows and MCP tools are needed. Keep responsibilities explicit: Skills decide and orchestrate; MCP tools perform external operations. Do not duplicate server behavior as opaque local scripts merely to avoid declaring MCP.

Test both failure directions: Skill works when a tool is intentionally optional, and required MCP failures are surfaced rather than silently replaced with invented results.

## Hooks

Add lifecycle hooks only for behavior that truly belongs to lifecycle boundaries such as session setup, evidence state, or bounded post-tool checks. Prefer default `hooks/hooks.json` discovery when supported. Plugin hooks are not automatically trusted merely because the plugin is installed; design for explicit review/trust and safe failure.

Hooks must not become hidden telemetry, prompt retention, credential collection, or a way to bypass normal host permissions. Keep commands relative to the plugin root and portable across supported environments.

## Public vs internal capabilities

A repository may contain more internal agents/Skills than the public plugin. Model this deliberately. Maintain a canonical public allowlist or exclusion layer at generation time, not a manual deletion after generation.

For every exclusion, verify all of these surfaces:

- public `skills/<slug>/`
- public native-agent copies if the plugin bundles them
- profile/config registrations
- generated maps and routing indexes
- default prompts and capabilities copy
- npm/runtime mirrors
- ZIP entries
- generated documentation counts

The public generator's check mode must fail if an excluded artifact reappears. This prevents a later regeneration from undoing a moderation or safety decision.
