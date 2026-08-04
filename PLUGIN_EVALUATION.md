# Plugin Evaluation

Date: 2026-08-04
Codex CLI: `0.145.0`
ChatGPT bundled Codex: `0.146.0-alpha.9.2`
Kaku: `0.15.0`
Bun: `1.3.14`
Plugin: `codex-self-improvement`
Installed version: `0.2.0+codex.20260804101214`

## Verified commands

```bash
bun test test
bun run plugin:test
bun run skills:health
python3 ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/codex-self-improvement
bun run plugin:health
bun run plugin:package
bun run plugin:smoke
bash scripts/install-curated-skills.sh
bash scripts/install-shell-integration.sh
bash scripts/install-plugin.sh
codex-harness doctor --json
kaku doctor
codex plugin list --json
/Applications/ChatGPT.app/Contents/Resources/codex plugin list --json
```

## Current results

- Full repository suite: 156 passing tests, 574 assertions, zero failures
- Final plugin install gate: 100 passing tests, 509 assertions, zero failures
- Official plugin validator: passed
- Plugin health: passed with six hook events, four plugin skills, no credential-shaped files, and no operating-system metadata files
- Curated skill health: passed for nine reviewed skills with canonical content hashes
- Reproducible curated skill reconstruction from pinned commits: passed
- Isolated install and installed `SessionStart` execution: verified through bounded `runtime.json`
- Kaku doctor: 8 ok, 0 warnings, 0 failures, 3 informational checks
- Kaku interactive probe: environment enabled, `surface=kaku`, Codex wrapper active, preexec loaded, `_csi_precmd` first, completion loaded
- Native Codex inventory: installed and enabled from the expected local marketplace root
- ChatGPT bundled Codex inventory: the same installed and enabled plugin version is visible through the shared Codex home
- Shell installer: idempotent, reversible, and retains a valid backup of the original Kaku interactive file
- Terminal state: command hashes and bounded metadata only, with no raw prompt, command, output, repository content, credential, personal data, or hidden reasoning retention

## Package

Path

`dist/codex-self-improvement-0.2.0+codex.20260804101214.zip`

SHA-256

`77b2040ec2165281bdfec894af378a66ffe0256c52490cef5c218f0e86b02023`

## Review and hardening

Completed CodeRabbit review rounds drove fixes for

- Concurrent per-turn state writes and pruning
- Active-lock preservation and bounded acquisition timeouts
- Recovery of abandoned directory leases after owner exit
- Hard expiry for PID reuse or reboot cases
- Recovery of abandoned recovery markers
- Linear excess-state pruning
- Guaranteed cleanup of the temporary smoke authentication link
- Marketplace name, root, and source verification
- Proposal-only durable learning behavior
- Canonical curated-content hash verification
- Reproducible skill reconstruction and transactional rollback
- Privacy, audit logging, password verification, secret handling, CI pinning, schema, and performance guidance

The last completed review returned four findings, all fixed with targeted regression tests

A subsequent review attempt after those fixes was rate-limited by CodeRabbit for 21 minutes, so a zero-finding final CodeRabbit result is not claimed

## Boundaries and remaining external issues

The hosted ChatGPT conversation runtime does not execute a local Codex plugin directly

ChatGPT-controlled Kaku and zsh commands inherit the local environment, terminal evidence tracking, and installed Codex plugin when Codex is invoked

The isolated Codex smoke loaded and executed the installed hook, then the model turn was rejected by the connected account usage limit

The smoke result records

- `hookExecution: verified`
- `modelTurn: quota-blocked`

`codex-harness doctor` reports the integration as healthy while retaining three external Codex observations

- The active Homebrew Codex install and the npm update target are different
- Optional MCP configuration issues exist
- The available update would target the other npm install

No model response or fresh before-versus-after model benchmark is claimed from the quota-blocked smoke

## Rollback

```bash
codex-harness uninstall
bash scripts/uninstall-universal.sh
codex plugin add codex-fierce@local-marketplace
```
