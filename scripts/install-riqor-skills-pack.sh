#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$ROOT/.agents/skills"

SKILLS=(
  "riqor"
  "riqor-verification-gate"
  "riqor-session-continuity"
  "riqor-code-intelligence"
  "riqor-agent-orchestrator"
)

TARGET_HOMES=(
  "$HOME/.gemini/config/skills"
  "$HOME/.codex/skills"
  "$HOME/.claude/skills"
)

echo "==> Installing Riqor Skills Pack for AI Agents..."

for target_home in "${TARGET_HOMES[@]}"; do
  mkdir -p "$target_home"
  for skill in "${SKILLS[@]}"; do
    if [[ -d "$SKILLS_DIR/$skill" ]]; then
      rm -rf "$target_home/$skill"
      cp -R "$SKILLS_DIR/$skill" "$target_home/$skill"
      echo "  [OK] Installed $skill -> $target_home/$skill"
    fi
  done
done

echo "==> Riqor Skills Pack installed successfully across AI agent environments!"
