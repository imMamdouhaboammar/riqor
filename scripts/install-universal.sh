#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash "$ROOT/scripts/install-shell-integration.sh"
bash "$ROOT/scripts/install-plugin.sh"
"$HOME/.local/bin/codex-harness" status --json
