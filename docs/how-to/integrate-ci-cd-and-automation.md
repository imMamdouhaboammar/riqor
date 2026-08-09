# How to Integrate CI/CD & Security Automation

This guide covers setting up GitHub Actions workflows for Riqor, including security scanning with **SecureAI-Scan**, dynamic status badges, and automated product previews with **AutoDemo**.

---

## 1. SecureAI-Scan Integration

Riqor uses `SecureAI-Scan` to audit AI, MCP, and Agent Skill surfaces for hardcoded secrets, dangerous prompt injection sinks, and unverified execution boundaries.

### Workflow Configuration (`.github/workflows/secureai.yml`)

```yaml
name: SecureAI Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0' # Weekly scan

jobs:
  security-scan:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Run SecureAI-Scan
        uses: secureai-scan/secureai-scan-action@v0.8.0
        with:
          scan-path: '.'
          confidence: 'likely'
          fail-on: 'high'
          upload-sarif: false # SARIF uploaded in dedicated step below

      - name: Upload SARIF report
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'secureai-results.sarif'
```

---

## 2. Dynamic Badges Setup

The `Dynamic Badges` workflow publishes CI quality gate status and package version endpoints to a GitHub Gist.

### Setup Instructions

1. Create a public GitHub Gist containing an initial JSON file.
2. Create a GitHub Personal Access Token (PAT) with `gist` permission.
3. Add the token to your repository Secrets as `GIST_SECRET`.
4. Add the Gist ID to your repository Variables as `RIQOR_BADGES_GIST_ID`.

### Embedding Badges in `README.md`

```markdown
[![Quality Gate](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/<owner>/<gist-id>/raw/riqor-quality-gate.json)](https://github.com/imMamdouhaboammar/riqor/actions/workflows/ci.yml)
[![Riqor Version](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/<owner>/<gist-id>/raw/riqor-version.json)](https://www.npmjs.com/package/riqor)
```

---

## 3. AutoDemo Product Capture

**AutoDemo** records visual walkthroughs and PNG captures of static documentation previews using Playwright.

### Local Execution

```bash
# Serve preview locally
python3 -m http.server 4173 --directory docs/preview &

# Run AutoDemo capture scenario
bunx @praveen-palanisamy/autodemo@0.2.0 run readme-overview \
  --config .autodemo.yml \
  --url http://127.0.0.1:4173 \
  --headless \
  --outDir artifacts/autodemo
```

---

## 4. Pinning GitHub Action Dependencies

All GitHub Actions in Riqor workflows must be pinned to immutable 40-character commit SHAs:

```yaml
# Good: Pinned commit SHA with version comment
uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

# Rejected: Floating version tags
uses: actions/checkout@v4
```

Run action verification before committing:

```bash
bun run actions:verify
```
