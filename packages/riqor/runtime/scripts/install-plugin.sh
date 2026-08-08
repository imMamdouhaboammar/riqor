#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN="$ROOT/plugins/codex-self-improvement"
MARKETPLACE_FILE="$ROOT/.agents/plugins/marketplace.json"
MARKETPLACE_NAME="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["name"])' "$MARKETPLACE_FILE")"
PLUGIN_NAME="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["name"])' "$PLUGIN/.codex-plugin/plugin.json")"
PACKAGE_MODE="${CODEX_SELF_IMPROVEMENT_PACKAGE_MODE:-0}"
[[ -n "${RIQOR_RUNTIME_ROOT:-}" ]] && PACKAGE_MODE=1

command -v codex >/dev/null
command -v python3 >/dev/null
[[ -f "$PLUGIN/.codex-plugin/plugin.json" ]]
[[ -f "$PLUGIN/hooks/hooks.json" ]]
[[ -f "$MARKETPLACE_FILE" ]]

MARKETPLACE_INVENTORY="$(codex plugin marketplace list --json)"
if printf '%s' "$MARKETPLACE_INVENTORY" | python3 "$ROOT/scripts/check-marketplace-source.py" "$MARKETPLACE_NAME" "$ROOT" >/dev/null; then
  :
else
  MARKETPLACE_STATUS=$?
  if [[ "$MARKETPLACE_STATUS" == "3" ]]; then
    codex plugin marketplace add "$ROOT"
  else
    exit "$MARKETPLACE_STATUS"
  fi
fi
if [[ "$PACKAGE_MODE" == "1" ]]; then
  codex plugin add "$PLUGIN_NAME@$MARKETPLACE_NAME"
  codex plugin list --json | python3 -c 'import json,sys; plugin=sys.argv[1]; market=sys.argv[2]; data=json.load(sys.stdin); matches=[x for x in data.get("installed",[]) if x.get("name")==plugin and x.get("marketplaceName")==market and x.get("installed")]; raise SystemExit(0 if matches else 1)' "$PLUGIN_NAME" "$MARKETPLACE_NAME"
  printf 'Installed %s@%s\n' "$PLUGIN_NAME" "$MARKETPLACE_NAME"
  exit 0
fi

VALIDATOR="${CODEX_PLUGIN_VALIDATOR:-$HOME/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py}"
CACHEBUSTER="${CODEX_PLUGIN_CACHEBUSTER:-$HOME/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py}"
command -v bun >/dev/null
python3 "$VALIDATOR" "$PLUGIN"
cd "$ROOT"
bun run plugin:test
bun run skills:health
bun run "$ROOT/scripts/plugin-health.ts" "$PLUGIN"
python3 "$CACHEBUSTER" "$PLUGIN"
python3 "$VALIDATOR" "$PLUGIN"
bun run "$ROOT/scripts/smoke-plugin.ts"
codex plugin add "$PLUGIN_NAME@$MARKETPLACE_NAME"
bun run "$ROOT/scripts/package-plugin.ts" "$PLUGIN"
codex plugin list --json | python3 -c 'import json,sys; plugin=sys.argv[1]; market=sys.argv[2]; data=json.load(sys.stdin); matches=[x for x in data.get("installed",[]) if x.get("name")==plugin and x.get("marketplaceName")==market and x.get("installed")]; raise SystemExit(0 if matches else 1)' "$PLUGIN_NAME" "$MARKETPLACE_NAME"
printf 'Installed %s@%s\n' "$PLUGIN_NAME" "$MARKETPLACE_NAME"
