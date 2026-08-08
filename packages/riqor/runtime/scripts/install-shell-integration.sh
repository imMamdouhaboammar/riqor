#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_BASE="${XDG_CONFIG_HOME:-$HOME/.config}"
CONFIG_DIR="$CONFIG_BASE/codex-self-improvement"
KAKU_PLUGIN_DIR="$CONFIG_BASE/kaku/zsh/plugins"
BIN_DIR="$HOME/.local/bin"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)-$$"
BACKUP_DIR="$CONFIG_DIR/backups/$STAMP"
PACKAGE_MODE="${CODEX_SELF_IMPROVEMENT_PACKAGE_MODE:-0}"

command -v python3 >/dev/null
if [[ "$PACKAGE_MODE" != "1" ]]; then command -v bun >/dev/null; fi
mkdir -p "$CONFIG_DIR" "$KAKU_PLUGIN_DIR" "$BIN_DIR" "$BACKUP_DIR"
chmod 700 "$CONFIG_DIR" "$BACKUP_DIR"

if [[ "${CODEX_SELF_IMPROVEMENT_SKIP_KAKU_INIT:-0}" != "1" ]] && command -v kaku >/dev/null 2>&1; then
  kaku init --update-only >/dev/null 2>&1 || true
fi

export ROOT CONFIG_DIR KAKU_PLUGIN_DIR BIN_DIR BACKUP_DIR
export CODEX_SELF_IMPROVEMENT_MANAGE_WRAPPERS="$([[ "$PACKAGE_MODE" == "1" ]] && printf 0 || printf 1)"
python3 "$ROOT/scripts/install-shell-integration.py"
printf 'Installed Codex Self Improvement shell integration\n'
