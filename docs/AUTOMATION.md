# Documentation and Security Automation

Riqor uses three focused GitHub Actions around the public repository surface:

| Workflow | Purpose | Default state |
| --- | --- | --- |
| `SecureAI-Scan` | Scan AI, MCP, and Agent Skill surfaces and upload SARIF | Active |
| `Dynamic Badges` | Publish CI and package version badge endpoints to a Gist | Ready after repository configuration |
| `AutoDemo Docs Capture` | Record the static product preview as video, walkthrough, and PNG assets | Active for preview changes and manual runs |

All action references in repository workflows are pinned to full commit SHAs. The version comments record the reviewed release tag.

## SecureAI-Scan

Workflow:

```text
.github/workflows/secureai.yml
```

The scan runs on:

- pushes to `main`
- pull requests targeting `main`
- a weekly schedule
- manual dispatch

Current policy:

- scanner package: `secureai-scan@0.8.0`
- scan path: repository root
- confidence mode: proven and likely findings
- CI threshold: fail on `high` or `critical`
- SARIF upload: enabled for trusted repository contexts
- report artifact retention: 14 days

The workflow sets `upload-sarif: false` on the scanner action and uploads the report through a separately pinned CodeQL SARIF action. This keeps the repository's direct workflow dependencies explicit.

Fork pull requests still run the scanner, but SARIF upload is skipped when the pull request cannot receive `security-events: write`. The report artifact step remains best effort.

### Review scan results

Open either:

- the failed workflow step for the scanner's terminal evidence
- the workflow artifact named `secureai-sarif-<run-id>`
- the repository Security tab for uploaded code scanning findings

Do not suppress a finding only to obtain a green workflow. Validate the source, flow, sink, affected boundary, and remediation first.

## Dynamic Badges

Workflow:

```text
.github/workflows/dynamic-badges.yml
```

The workflow runs after the main `CI` workflow completes for `main`. It is intentionally inactive until the repository has a badge Gist and credential.

### Required configuration

1. Create a public Gist with any initial JSON file
2. Create a GitHub token that can update that Gist
3. Add the token as an Actions secret named `GIST_SECRET`
4. Add the Gist ID as a repository variable named `RIQOR_BADGES_GIST_ID`

The workflow then maintains:

```text
riqor-quality-gate.json
riqor-version.json
```

The quality badge reflects the conclusion of the verified `CI` run. The version badge reads `packages/riqor/package.json` from the exact commit that completed CI.

### Add the badges to the README

Replace the placeholders with the Gist owner and ID:

```markdown
[![Quality gate](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/<owner>/<gist-id>/raw/riqor-quality-gate.json)](https://github.com/imMamdouhaboammar/riqor/actions/workflows/ci.yml)
[![Riqor version](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/<owner>/<gist-id>/raw/riqor-version.json)](https://www.npmjs.com/package/riqor)
```

Do not add these endpoint badges to the public README before the Gist files exist. A broken badge weakens the repository's first impression.

### Token scope

Use the narrowest token that can update the selected Gist. Store it only as an Actions secret. Never commit the token, print it in logs, or place it in repository variables.

## AutoDemo Docs Capture

Workflow:

```text
.github/workflows/autodemo.yml
```

Inputs and source files:

```text
docs/preview/index.html   static product preview
.autodemo.yml             deterministic capture scenario
```

The workflow:

1. Serves the static preview on `127.0.0.1:4173`
2. Runs the deterministic `readme-overview` scenario
3. Captures the hero, product controls, workflow, security section, and full page
4. Produces video, interactive walkthrough, screenshots, and run metadata
5. Uploads `artifacts/autodemo` as a workflow artifact for 14 days

The workflow runs on pull requests and pushes that change the preview, scenario, or workflow. It can also be started manually.

### Local preview

```bash
python3 -m http.server 4173 --directory docs/preview
```

Open:

```text
http://127.0.0.1:4173
```

### Local capture

With Bun and Playwright available:

```bash
bunx @praveen-palanisamy/autodemo@0.2.0 run readme-overview \
  --config .autodemo.yml \
  --url http://127.0.0.1:4173 \
  --headless \
  --no-tui \
  --outDir artifacts/autodemo
```

The scenario contains deterministic Playwright steps and needs no LLM key.

## Updating Action Versions

When changing an action version:

1. Review the release notes and action metadata
2. Resolve the release tag to its exact 40-character commit SHA
3. Update the workflow reference and version comment together
4. Run `bun run actions:verify`
5. Review permissions, new inputs, runtime changes, and transitive action behavior
6. Let CI verify the updated workflow on the current branch

Floating tags such as `@main`, `@v0`, or `@v4` are not accepted in Riqor workflow files.
