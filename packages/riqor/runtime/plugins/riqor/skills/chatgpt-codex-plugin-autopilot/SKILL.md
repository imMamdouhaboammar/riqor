---
name: chatgpt-codex-plugin-autopilot
description: Use when building, repairing, validating, packaging, submitting, publishing, or auditing a ChatGPT/Codex Plugin in any repository. Handles skills-only, MCP-backed, hybrid plugins, Plugin Directory readiness, moderation-safe public packaging, deterministic ZIPs, and Full Autopilot Publish.
---

# ChatGPT/Codex Plugin Autopilot

Take an arbitrary repository from discovery to a verified ChatGPT/Codex Plugin release. Treat the target repository as authoritative for product behavior and release channels. Never require Riqor, Bun, Node, or a Riqor-specific layout.

## Operating contract

1. Verify the current official OpenAI Plugin and Skill documentation before editing public plugin configuration. Current official docs override remembered schema, examples, and numeric limits. Read `references/official-contract.md` and record the verification date.
2. Inspect repository instructions, dirty state, package metadata, manifests, Skills, MCP/app configuration, hooks, assets, legal/support pages, CI, tags, release scripts, and registry policy before changing anything.
3. Classify the target using `references/architectures.md` as `skills-only`, `MCP-backed`, or `hybrid`. Add hooks, MCP, app mappings, or UI only when required by the target behavior.
4. Run a public-distribution safety review before generating or packaging public Skills. Internal capability does not imply Plugin Directory suitability.
5. Build or repair `.codex-plugin/plugin.json`, focused Skills, optional `agents/openai.yaml`, optional MCP/app configuration, optional hooks, square branding, and accurate public URLs.
6. Apply final Plugin Directory limits, not only looser package-validation limits.
7. Run repository-native tests plus `scripts/validate_plugin.py` and fail closed on every unknown or error.
8. Build the ZIP twice with `scripts/package_plugin.py` and require byte-identical SHA256 results.
9. Inspect the archive root, files, counts, excluded capabilities, secrets/privacy boundary, and installation behavior.
10. Smoke a fresh install on every available ChatGPT/Codex surface. Do not claim unavailable surfaces were tested.
11. Diagnose uploader or review failures using `references/submission-errors.md`; repair root causes and rerun the full gate.
12. Under Full Autopilot Publish, commit, tag, push, publish, and create releases without another routine confirmation only after all gates pass. Follow `references/release-playbook.md`.
13. Download published artifacts and compare hashes or bytes whenever the channel supports deterministic identity. Report exact commit, tag, versions, hashes, test evidence, remote checks, and any residual warning.

## Public-distribution safety gate

Review every public Skill name, description, instructions, references, generated native-agent copy, profile registration, routing index, capability label, and packaged executable behavior for usage-policy and moderation risk. Never blindly mirror all internal agents into a public plugin.

When a capability must stay internal, place the exclusion at the canonical generation or packaging boundary. Remove every public replica and registration, including generated Skill directories, reference instructions, native-agent copies, profile entries, maps, indexes, manifest counts/copy, runtime mirrors, and archive entries. Regeneration must not restore an excluded capability.

Pass each excluded slug to the validator:

```bash
python3 <skill-root>/scripts/validate_plugin.py <plugin-root> --exclude <slug> --json
```

A stale excluded slug in any public path or UTF-8 text file is a blocking failure.

## Generic preflight

```bash
python3 <skill-root>/scripts/validate_plugin.py <plugin-root> --json
python3 <skill-root>/scripts/package_plugin.py <plugin-root> /tmp/plugin-a.zip --json
python3 <skill-root>/scripts/package_plugin.py <plugin-root> /tmp/plugin-b.zip --json
cmp /tmp/plugin-a.zip /tmp/plugin-b.zip
unzip -Z1 /tmp/plugin-a.zip
```

Keep repository-native quality, security, domain acceptance, smoke, and release checks in addition to this generic gate. The generic tooling does not replace project-specific validation.

## Stop conditions

Stop before irreversible publication when current required OpenAI rules cannot be verified, repository identity is ambiguous, required credentials are unavailable, tests or validation fail, the target version already exists on an immutable registry, archive identity is nondeterministic when determinism is promised, public policy copy contradicts behavior, or the requested action exceeds the user's authorized scope.

Do not weaken tests, hide uploader failures, rewrite released tags, inject registry credentials into CI, force-push unrelated history, or claim a successful Plugin Directory submission when only a local ZIP was prepared.
