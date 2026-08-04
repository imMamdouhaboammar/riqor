#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="$ROOT/.skill-curation-stage.$$"
BACKUP="$ROOT/.agents/skills.backup.$$"
AK_COMMIT="0a37e31d584be9050aec0d49917970f1795bde63"
AS_COMMIT="62d620e4fc009d211dd53b34a3e722d22eb396f4"
MP_COMMIT="2ab958093e83e0ec752e6c1c5932da465bf23e0c"

SUCCESS=0
REPLACED=0
cleanup() {
  local status=$?
  rm -rf "$STAGE"
  if [[ "$SUCCESS" == "1" ]]; then
    rm -rf "$BACKUP"
  elif [[ "$REPLACED" == "1" ]]; then
    rm -rf "$ROOT/.agents/skills"
    if [[ -d "$BACKUP" ]]; then mv "$BACKUP" "$ROOT/.agents/skills"; fi
  fi
  return "$status"
}
trap cleanup EXIT

command -v git >/dev/null
command -v npx >/dev/null
command -v python3 >/dev/null
mkdir -p "$STAGE/sources"
printf '{"private":true}\n' > "$STAGE/package.json"

git clone --quiet https://github.com/imMamdouhaboammar/agent-kernel.git "$STAGE/sources/agent-kernel"
git -C "$STAGE/sources/agent-kernel" checkout --quiet "$AK_COMMIT"
git clone --quiet https://github.com/imMamdouhaboammar/antigravity-superpowers.git "$STAGE/sources/antigravity-superpowers"
git -C "$STAGE/sources/antigravity-superpowers" checkout --quiet "$AS_COMMIT"
git clone --quiet https://github.com/mattpocock/skills.git "$STAGE/sources/mattpocock-skills"
git -C "$STAGE/sources/mattpocock-skills" checkout --quiet "$MP_COMMIT"
cd "$STAGE"
npx skills add "$STAGE/sources/agent-kernel" \
  --skill architecture-guardian agent-kernel-evolve \
  --agent codex --copy -y --full-depth
npx skills add "$STAGE/sources/antigravity-superpowers" \
  --skill agency-application-security-engineer agency-multi-agent-systems-architect \
  agency-performance-benchmarker agency-privacy-engineer \
  agency-secrets-credential-hygiene-engineer agency-test-automation-engineer \
  --agent codex --copy -y --full-depth
npx skills add "$STAGE/sources/mattpocock-skills" \
  --skill code-review --agent codex --copy -y --full-depth
find "$STAGE/.agents/skills" -name .DS_Store -delete

ROOT="$ROOT" STAGE="$STAGE" python3 <<'PY'
import json, os
from pathlib import Path
expected = json.loads((Path(os.environ["ROOT"]) / "skills-lock.json").read_text())["skills"]
actual = json.loads((Path(os.environ["STAGE"]) / "skills-lock.json").read_text())["skills"]
if set(expected) != set(actual):
    raise SystemExit("curated skill allowlist mismatch")
for name, record in expected.items():
    if record["computedHash"] != actual[name]["computedHash"]:
        raise SystemExit(f"upstream hash mismatch for {name}")
PY

git -C "$STAGE" init --quiet
git -C "$STAGE" apply --check "$ROOT/config/curated-skills.patch"
git -C "$STAGE" apply "$ROOT/config/curated-skills.patch"
rm -rf "$STAGE/sources" "$STAGE/.git" "$STAGE/package.json" "$STAGE/skills-lock.json"

cd "$ROOT"
rm -rf "$BACKUP"
if [[ -d .agents/skills ]]; then mv .agents/skills "$BACKUP"; fi
REPLACED=1
mkdir -p .agents
mv "$STAGE/.agents/skills" .agents/skills
bun run scripts/skill-curation-health.ts
SUCCESS=1
printf 'Installed reviewed curated skills from pinned revisions\n'
