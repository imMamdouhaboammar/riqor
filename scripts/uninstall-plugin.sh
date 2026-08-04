#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MARKETPLACE_FILE="$ROOT/.agents/plugins/marketplace.json"
MARKETPLACE_NAME="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["name"])' "$MARKETPLACE_FILE")"
PLUGIN_NAME="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["plugins"][0]["name"])' "$MARKETPLACE_FILE")"

if codex plugin list --json | python3 -c 'import json,sys; plugin=sys.argv[1]; market=sys.argv[2]; data=json.load(sys.stdin); raise SystemExit(0 if any(x.get("name")==plugin and x.get("marketplaceName")==market and x.get("installed") for x in data.get("installed",[])) else 1)' "$PLUGIN_NAME" "$MARKETPLACE_NAME"; then
  codex plugin remove "$PLUGIN_NAME@$MARKETPLACE_NAME"
else
  printf '%s@%s is not installed\n' "$PLUGIN_NAME" "$MARKETPLACE_NAME"
fi

if [[ "${1:-}" == "--remove-marketplace" ]]; then
  codex plugin marketplace remove "$MARKETPLACE_NAME"
fi
