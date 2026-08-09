# Riqor Marketplace Agent Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Riqor 0.2.4 with 101 portable Marketplace Skills paired mandatorily to 101 native Codex agents, public legal/support URLs, and a local-only adoption ledger, then publish npm/GitHub artifacts and prepare the ChatGPT Plugins release ZIP.

**Architecture:** Canonical `.codex/agents/*.toml` files drive deterministic generated plugin agents, paired Skills, references, metadata, mapping, and routing index. The npm runtime packages the same plugin directory. Adoption data is a separate local JSON ledger with no network code and privacy-preserving receipt export.

**Tech Stack:** Bun, TypeScript, TOML, Markdown/YAML, Node fs/crypto, deterministic ZIP packaging, npm, GitHub Actions

## Global Constraints

- Preserve exactly 101 native Codex agents and existing 11 hand-maintained Riqor Skills
- Generate exactly 101 paired specialist Skills, for 112 total plugin Skills
- Every native agent must require its exact paired Skill before task execution
- Public plugin remains skills/hooks only: no Apps, MCP servers, or tool configuration
- Adoption tracking is local-only by default with no phone-home or hidden telemetry
- npm publishing happens only from the authenticated local terminal
- GitHub Actions must never publish npm
- Target release is 0.2.4

---

### Task 1: Deterministic agent-to-Skill generation

**Files:**
- Create: `scripts/generate-agent-skills.ts`
- Create: `test/agent-skill-pairing.test.ts`
- Generate: `plugins/riqor/skills/<101 slugs>/...`, `plugins/riqor/.codex/agents/*.toml`, `plugins/riqor/agent-skill-map.json`
- Modify: `plugins/riqor/skills/riqor-core/references/specialists.md`

- [ ] Write failing tests for 101 source agents, 101 paired Skills, 101 mappings, mandatory pairing text, deterministic regeneration, valid frontmatter/UI metadata, hashes, and 112 total Skills
- [ ] Run the focused test and confirm RED because generator/artifacts are absent
- [ ] Implement deterministic generator using canonical TOML name/description/developer instructions
- [ ] Generate artifacts and run the focused test to GREEN
- [ ] Run existing agent/plugin package tests and commit

### Task 2: Marketplace legal/support metadata

**Files:**
- Create: `PRIVACY.md`, `TERMS.md`, `SUPPORT.md`
- Modify: `plugins/riqor/.codex-plugin/plugin.json`
- Modify: `scripts/plugin-health.ts`
- Modify/Test: `test/plugin-package.test.ts`, `test/plugin-build.test.ts`

- [ ] Write failing tests for the three official HTTPS manifest fields and public documents
- [ ] Confirm RED
- [ ] Add `privacyPolicyURL`, `termsOfServiceURL`, `supportURL`; document actual local behavior without invented SaaS claims
- [ ] Extend plugin health to validate required public listing URLs
- [ ] Run focused tests to GREEN and commit

### Task 3: Offline adoption ledger

**Files:**
- Create: `packages/riqor/src/adoption.ts`
- Create: `packages/riqor/test/adoption.test.ts`
- Modify: `packages/riqor/src/cli.ts`, `packages/riqor/src/commands/install.ts`
- Modify: `plugins/riqor/hooks/main.ts`
- Modify/Test: hook/runtime tests as required

- [ ] Write failing tests for first-seen/version state, active-day/session counts, agent/Skill counters, random local ID, denylisted sensitive fields, reset, JSON report, export receipt buckets, and absence of networking primitives
- [ ] Confirm RED
- [ ] Implement atomic local ledger reads/writes under the existing Riqor user state path and `PLUGIN_DATA` when hook-local storage is available
- [ ] Add `riqor adoption`, `--json`, `--reset`, and `--export <path>`; do not add sharing/upload
- [ ] Record install/session/subagent events without prompts or task content
- [ ] Run focused tests to GREEN and commit

### Task 4: Packaging and release readiness

**Files:**
- Modify: package/build tests and docs that assert catalog contents
- Modify: `README.md`, `packages/riqor/README.md`, `CHANGELOG.md`
- Create: `docs/releases/0.2.4.md`
- Modify: repository/package/plugin/marketplace/Homebrew version metadata required by existing alignment tests

- [ ] Write/update packaging assertions for 101 paired Skills, 101 agents, mapping, legal docs/URLs, and npm runtime parity
- [ ] Bump all release metadata to 0.2.4 and generate a timestamped plugin build version if the repo convention requires it
- [ ] Build package/plugin artifacts twice and verify deterministic hashes
- [ ] Run full repository suite, plugin health, packaged runtime suite, security/policy scans available locally, release preflight, and artifact inspection
- [ ] Commit release candidate

### Task 5: Publish and remote verification

- [ ] Merge the verified feature branch onto `main` without force-pushing unrelated history
- [ ] Re-run release gate on the exact release commit
- [ ] Build npm tarball and publish `riqor@0.2.4` from authenticated local terminal only
- [ ] Verify npm registry version, shasum/integrity, package contents, and runtime tests from the published tarball
- [ ] Push `main`, create/push tag `v0.2.4`, and let GitHub Release workflow verify registry bytes instead of publishing npm
- [ ] Verify CI/security/release workflows and GitHub Release assets remotely
- [ ] Inspect the final plugin ZIP: root `.codex-plugin/`, 101 agents, 101 paired specialist Skills, 112 total Skills, legal metadata, no wrapper directory or credential-shaped files
- [ ] Report the exact ChatGPT Plugins ZIP path/hash and the manual submission step if the authenticated submission portal cannot be automated from available tools
