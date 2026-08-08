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
home = Path(os.environ.get("HOME", str(Path.home())))
manage_wrappers = os.environ.get("CODEX_SELF_IMPROVEMENT_MANAGE_WRAPPERS", "1") != "0"

for directory in (config_dir, kaku_dir, bin_dir, backup_dir):
    directory.mkdir(parents=True, exist_ok=True)

start = "# >>> codex-self-improvement >>>"
end = "# <<< codex-self-improvement <<<"
block = (
    f"{start}\n"
    '[[ -r "${XDG_CONFIG_HOME:-$HOME/.config}/codex-self-improvement/env.zsh" ]] '
    '&& source "${XDG_CONFIG_HOME:-$HOME/.config}/codex-self-improvement/env.zsh"\n'
    f"{end}"
)


def render_managed_block(original: str, managed: str) -> str:
    lines = original.splitlines()
    output = []
    skipping = False
    for line in lines:
        if line == start:
            if skipping:
                raise RuntimeError("malformed codex-self-improvement markers: nested start marker")
            skipping = True
            continue
        if line == end:
            if not skipping:
                raise RuntimeError("malformed codex-self-improvement markers: end marker without start")
            skipping = False
            continue
        if not skipping:
            output.append(line)
    if skipping:
        raise RuntimeError("malformed codex-self-improvement markers: start marker without end")
    text = "\n".join(output).rstrip()
    return (text + "\n\n" if text else "") + managed + "\n"


zshenv = home / ".zshenv"
original_zshenv = zshenv.read_text() if zshenv.exists() else ""
rendered_zshenv = render_managed_block(original_zshenv, block)


shell_templates_dir = Path(os.environ.get("SHELL_TEMPLATES_DIR", str(root / "config/shell")))
rendered = (
    shell_templates_dir / "codex-self-improvement-env.zsh"
).read_text().replace("__HARNESS_ROOT__", str(root))
env_path = config_dir / "env.zsh"
env_path.write_text(rendered)
env_path.chmod(0o600)

kaku_path = kaku_dir / "codex-self-improvement.zsh"
kaku_path.write_text(
    (shell_templates_dir / "codex-self-improvement-kaku.zsh").read_text()
)
kaku_path.chmod(0o600)

if manage_wrappers:
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

if zshenv.exists():
    shutil.copy2(zshenv, backup_dir / "zshenv.backup")
zshenv.write_text(rendered_zshenv)
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
