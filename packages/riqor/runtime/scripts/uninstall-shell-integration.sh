#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_BASE="${XDG_CONFIG_HOME:-$HOME/.config}"
CONFIG_DIR="$CONFIG_BASE/codex-self-improvement"
KAKU_PLUGIN_DIR="$CONFIG_BASE/kaku/zsh/plugins"
BIN_DIR="$HOME/.local/bin"
PACKAGE_MODE="${CODEX_SELF_IMPROVEMENT_PACKAGE_MODE:-0}"

export CONFIG_DIR KAKU_PLUGIN_DIR BIN_DIR
export CODEX_SELF_IMPROVEMENT_MANAGE_WRAPPERS="$([[ "$PACKAGE_MODE" == "1" ]] && printf 0 || printf 1)"
python3 "$ROOT/scripts/uninstall-shell-integration.py"
printf 'Removed Codex Self Improvement shell integration\n'
