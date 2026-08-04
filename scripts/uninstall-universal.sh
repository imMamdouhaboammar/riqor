#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash "$ROOT/scripts/uninstall-plugin.sh" || true
bash "$ROOT/scripts/uninstall-shell-integration.sh"
