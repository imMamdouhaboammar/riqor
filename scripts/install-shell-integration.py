from pathlib import Path
import hashlib
import json
import os
import shutil

root = Path(os.environ["ROOT"])
config_dir = Path(os.environ["CONFIG_DIR"])
kaku_dir = Path(os.environ["KAKU_PLUGIN_DIR"])
bin_dir = Path(os.environ["BIN_DIR"])
backup_dir = Path(os.environ["BACKUP_DIR"])
home = Path.home()

start = "# >>> codex-self-improvement >>>"
end = "# <<< codex-self-improvement <<<"
block = (
    f"{start}\n"
    '[[ -r "$HOME/.config/codex-self-improvement/env.zsh" ]] '
    '&& source "$HOME/.config/codex-self-improvement/env.zsh"\n'
    f"{end}"
)


def replace_block(path: Path, managed: str) -> None:
    original = path.read_text() if path.exists() else ""
    lines = original.splitlines()
    output = []
    skipping = False
    for line in lines:
        if line == start:
            skipping = True
            continue
        if skipping and line == end:
            skipping = False
            continue
        if not skipping:
            output.append(line)
    text = "\n".join(output).rstrip()
    path.write_text((text + "\n\n" if text else "") + managed + "\n")


rendered = (
    root / "config/shell/codex-self-improvement-env.zsh"
).read_text().replace("__HARNESS_ROOT__", str(root))
env_path = config_dir / "env.zsh"
env_path.write_text(rendered)
env_path.chmod(0o600)

kaku_path = kaku_dir / "codex-self-improvement.zsh"
kaku_path.write_text(
    (root / "config/shell/codex-self-improvement-kaku.zsh").read_text()
)
kaku_path.chmod(0o600)

wrapper = bin_dir / "codex-harness"
wrapper.write_text(
    "#!/usr/bin/env bash\n"
    "# Managed by Codex Self Improvement\n"
    "set -euo pipefail\n"
    f"exec bun run {json.dumps(str(root / 'src/harness-cli.ts'))} \"$@\"\n"
)
wrapper.chmod(0o755)
alias = bin_dir / "cxh"
if alias.exists() or alias.is_symlink():
    alias.unlink()
alias.symlink_to(wrapper.name)

zshenv = home / ".zshenv"
if zshenv.exists():
    shutil.copy2(zshenv, backup_dir / "zshenv.backup")
replace_block(zshenv, block)
zshenv.chmod(0o600)

loader = kaku_dir / "kaku-shell-loader.zsh"
if loader.exists():
    shutil.copy2(loader, backup_dir / "kaku-shell-loader.zsh.backup")
loader_text = loader.read_text() if loader.exists() else "# Managed Kaku shell loader\n"
source_line = (
    '[[ -r "$HOME/.config/kaku/zsh/plugins/codex-self-improvement.zsh" ]] '
    '&& source "$HOME/.config/kaku/zsh/plugins/codex-self-improvement.zsh"'
)
loader_lines = [
    line for line in loader_text.splitlines()
    if "plugins/codex-self-improvement.zsh" not in line
]
loader.write_text("\n".join(loader_lines).rstrip() + "\n" + source_line + "\n")
loader.chmod(0o600)
interactive = kaku_dir / "kaku-harness-interactive.zsh"
manifest_path = config_dir / "install-manifest.json"
previous_manifest = {}
if manifest_path.exists():
    try:
        previous_manifest = json.loads(manifest_path.read_text())
    except Exception:
        previous_manifest = {}

interactive_backup = previous_manifest.get("interactiveBackup")
if interactive_backup and not Path(interactive_backup).exists():
    interactive_backup = None
patched_sha = previous_manifest.get("interactivePatchedSha")

broken = (
    '[[ -n "${_KAKU_SKILLS_HARNESS_LOADED:-}" ]] && return 0\n'
    "typeset -g _KAKU_SKILLS_HARNESS_LOADED=1\n"
)
expected_prefix = "# Managed interactive Kaku harness.\n" + broken


def curate_interactive(text):
    return text.replace(broken, "", 1).replace(
        "Execution blocked to prevent credential leakage in shell history.",
        "Review this command because it may expose a credential in shell history.",
    )


if interactive.exists():
    text = interactive.read_text()
    current_sha = hashlib.sha256(text.encode()).hexdigest()
    if not interactive_backup:
        for candidate in sorted(config_dir.glob("backups/*/kaku-harness-interactive.zsh.backup")):
            original = candidate.read_text()
            if hashlib.sha256(curate_interactive(original).encode()).hexdigest() == current_sha:
                interactive_backup = str(candidate)
                patched_sha = current_sha
                break
    if text.startswith(expected_prefix):
        if not interactive_backup:
            backup = backup_dir / "kaku-harness-interactive.zsh.backup"
            shutil.copy2(interactive, backup)
            interactive_backup = str(backup)
        text = curate_interactive(text)
        interactive.write_text(text)
        patched_sha = hashlib.sha256(text.encode()).hexdigest()

manifest = {
    "version": 1,
    "root": str(root),
    "backupDir": str(backup_dir),
    "interactiveBackup": interactive_backup,
    "interactivePatchedSha": patched_sha,
}
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
manifest_path.chmod(0o600)
