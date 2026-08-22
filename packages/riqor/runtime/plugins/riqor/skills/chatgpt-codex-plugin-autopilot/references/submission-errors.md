# Submission and Review Failure Playbook

Treat uploader/review messages as evidence. Map each error to the producing source, fix it there, regenerate, and rerun the full gate. Do not patch only the final ZIP when a generator will recreate the failure.

## Root and archive failures

`plugin_root_ambiguous` or `plugin_root_has_siblings`: package exactly one plugin root. Prefer `.codex-plugin/` directly at archive root. Remove wrapper siblings and accidental parent-directory files.

`archive_too_many_entries`, `archive_uncompressed_too_large`, or `archive_member_too_large`: remove unnecessary generated/dev artifacts at source. Do not silently omit runtime files that the plugin actually needs. Re-evaluate whether oversized assets belong behind an MCP/server boundary.

Path duplicate, normalization collision, unsupported type, or unreadable member: reject symlinks/special files, normalize paths, remove case/Unicode collisions, and rebuild with ordinary files/directories and supported compression.

## Manifest/listing failures

For display name, short description, developer name, and URL length errors, optimize for the stricter final-directory limits, not only package-validator limits. Keep short description one line. Use a supported category or omit category to fall back to Other when current docs allow it.

For MCP-backed listing URL failures, provide all four stable HTTPS destinations: website, privacy, terms, and support. The documents must match real product behavior and data handling.

## Image failures

If logo/composer icon is missing, non-square, too small, too large, malformed, or has an extension/content mismatch, fix the source asset. SVG needs a valid `<svg>` root and numeric square dimensions. Do not point the required square fields at a horizontal wordmark.

## Skill failures

Ensure each Skill has `skills/<skill>/SKILL.md` with valid `name` and `description`. Keep descriptions concise, trigger-oriented, and specific enough for implicit discovery. For a large catalog, reduce discovery noise rather than inflating every description.

## App/MCP reference failures

Do not assume a local `.app.json` reference can be published as a public existing ChatGPT app. Skills-only public upload and MCP-backed submission have distinct behavior. Use the current public MCP submission route when the plugin actually depends on MCP.

## Moderation or policy review failure

A review label such as cyber abuse, fraud/scams, or security risk is not an ordinary schema error. Inspect the actual capability and its public instructions before deciding to appeal. An internal role can be valid for private engineering while still being inappropriate for broad public distribution.

When removal is the chosen remediation, delete the capability from every public surface, not only its generated Skill directory. Trace the source-to-package path and update the canonical generator/allowlist/exclusion layer. Remove generated Skill instructions, native-agent public copies, profile registration, routing maps/indexes, manifest capability/count copy, runtime mirrors, and archive entries. Add a regression test and generation check that fail if the excluded identity returns.

Preserve an internal canonical source only when it remains useful, is clearly outside the public plugin, and the product's security policy allows it. Do not rename an unchanged rejected capability merely to evade review.

After remediation, build a new versioned artifact, run public-exclusion scans against both source and ZIP, and submit the new artifact according to the directory's current update/review flow.
