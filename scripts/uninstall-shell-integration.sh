#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_DIR="$HOME/.config/codex-self-improvement"
KAKU_PLUGIN_DIR="$HOME/.config/kaku/zsh/plugins"
BIN_DIR="$HOME/.local/bin"

export CONFIG_DIR KAKU_PLUGIN_DIR BIN_DIR
python3 "$ROOT/scripts/uninstall-shell-integration.py"
printf 'Removed Codex Self Improvement shell integration\n'
