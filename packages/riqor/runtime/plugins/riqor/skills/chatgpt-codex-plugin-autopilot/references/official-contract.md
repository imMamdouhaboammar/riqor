# Official OpenAI Plugin Contract Baseline

Checked against official OpenAI documentation on 2026-08-09. Re-check these pages at the start of every public plugin task because submission rules can change:

- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/deploy/submission-errors
- https://learn.chatgpt.com/docs/build-skills

Current official documentation is authoritative over this snapshot.

## Package shape

Every plugin uses `.codex-plugin/plugin.json` as the native manifest entry point. Plugin-root resources may include `skills/`, `.mcp.json`, `.app.json` compatibility mappings, assets, and lifecycle hooks. Keep component paths relative to the plugin root and `./`-prefixed where referenced by the manifest. When hooks live at `./hooks/hooks.json`, default discovery can avoid a manifest `hooks` field.

Public plugins are published once to the universal plugin directory shared by ChatGPT and Codex. Local/repository marketplaces are authoring, testing, private/team distribution surfaces, not evidence that the public directory accepted the package.

## Public ZIP limits

- at most 5,000 archive entries
- at most 512 MiB extracted/uncompressed total
- at most 100 MiB for any individual archive member
- regular files and directories only
- readable, supported, non-encrypted compression
- unique paths with no duplicate or case/Unicode normalization collision
- exactly one plugin root, either directly at archive root or inside one top-level directory
- when a wrapper directory is used, it cannot have sibling files
- a skills-only upload contains a supported manifest and at least one valid `skills/<skill>/SKILL.md`

Prefer archive-root layout with `.codex-plugin/` directly at ZIP root. It reduces root ambiguity and has been proven in production releases.

## Manifest and final-directory limits

Use strict semver for `version`. Keep plugin name at 64 characters or fewer and in the supported ASCII identifier form. Keep description within 1,024 characters and provide `author.name`.

For final public directory submission, apply the stricter listing limits:

- `interface.displayName`: required, non-empty, <= 30 characters
- `interface.shortDescription`: required, one line, <= 30 characters
- `interface.longDescription`: required, <= 4,000 characters
- `interface.developerName`: required, <= 80 characters
- `interface.capabilities`: at most 20 items, each non-empty, one line, and <= 120 characters
- `interface.defaultPrompt`: at most 3 prompts, each non-empty, unique after normalization, one line, <= 128 characters, with no app `@mention`
- public listing URLs: <= 1,024 characters, HTTPS
- `interface.brandColor` / `brandColorDark`: optional six-digit hex colors; light needs >=2:1 contrast against white and dark needs >=2:1 against `#212121`

The four public listing URLs are website, privacy policy, terms, and support. They are optional for skills-only packages in the shared validator and required for MCP-backed public submissions. For a serious public skills-only plugin, prefer supplying stable accurate URLs unless the product intentionally has none.

Supported public categories currently include Productivity, Creativity, Developer Tools, Business & Operations, Data & Analytics, Communication, Education & Research, Security, Finance, Healthcare, Travel, Entertainment, and Other.

## Branding

`interface.logo` and `interface.composerIcon` are required for directory submission and must reference square images. Supported formats are PNG, JPG/JPEG, WebP, and SVG. Image files must be <= 5 MiB. Raster dimensions must be at least 48x48 and at most 4096x4096. SVG must be valid UTF-8 XML with an `<svg>` root and numeric square dimensions from `viewBox` or numeric width/height; public validation requires at least 48x48.

## Skills

A Skill is an immediate child directory of `skills/` with required `SKILL.md` and optional `scripts/`, `references/`, `assets/`, and `agents/openai.yaml`. `SKILL.md` needs `name` and `description` metadata. The combined `plugin-name:skill-name` identity must be <=64 characters, the description must be <=1,024 characters, and the Skill body must not be empty. ChatGPT and Codex initially discover Skills from name/description and load the full instructions after selection, so front-load trigger language and keep boundaries precise.

Codex bounds the initial Skill list to 2% of context or 8,000 characters when context size is unknown. Large plugin catalogs can have shortened or omitted discovery descriptions. Keep one focused job per Skill rather than relying on large generic descriptions.

`agents/openai.yaml` can configure UI appearance, invocation policy, and tool dependencies. It is optional; do not invent MCP dependencies merely to populate it.

Every public Plugin Directory submission also requires safety/security scans for every bundled Skill plus verified publisher identity and policy attestations. MCP-backed submissions additionally require the current production-server review materials, tool annotations/justifications, test cases, domain verification, release notes, and demo requirements described by the official submission guide.

## App/MCP submission boundary

A public skills-only upload does not publish references to an existing ChatGPT app and may remove `.app.json`. An MCP-backed submission must use the MCP submission path and submit the server integration directly. Treat `.app.json` as compatibility/local-workspace configuration unless current official submission docs explicitly support the intended public use.
