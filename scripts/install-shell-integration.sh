#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_DIR="$HOME/.config/codex-self-improvement"
KAKU_PLUGIN_DIR="$HOME/.config/kaku/zsh/plugins"
BIN_DIR="$HOME/.local/bin"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)-$$"
BACKUP_DIR="$CONFIG_DIR/backups/$STAMP"

command -v python3 >/dev/null
command -v bun >/dev/null
mkdir -p "$CONFIG_DIR" "$KAKU_PLUGIN_DIR" "$BIN_DIR" "$BACKUP_DIR"
chmod 700 "$CONFIG_DIR" "$BACKUP_DIR"

if [[ "${CODEX_SELF_IMPROVEMENT_SKIP_KAKU_INIT:-0}" != "1" ]] && command -v kaku >/dev/null 2>&1; then
  kaku init --update-only >/dev/null 2>&1 || true
fi

export ROOT CONFIG_DIR KAKU_PLUGIN_DIR BIN_DIR BACKUP_DIR
python3 "$ROOT/scripts/install-shell-integration.py"
printf 'Installed Codex Self Improvement shell integration\n'
