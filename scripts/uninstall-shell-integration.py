from pathlib import Path
import hashlib
import json
import os
import shutil

config_dir = Path(os.environ["CONFIG_DIR"])
kaku_dir = Path(os.environ["KAKU_PLUGIN_DIR"])
bin_dir = Path(os.environ["BIN_DIR"])
home = Path.home()
start = "# >>> codex-self-improvement >>>"
end = "# <<< codex-self-improvement <<<"

zshenv = home / ".zshenv"
if zshenv.exists():
    output = []
    skipping = False
    for line in zshenv.read_text().splitlines():
        if line == start:
            skipping = True
            continue
        if skipping and line == end:
            skipping = False
            continue
        if not skipping:
            output.append(line)
    zshenv.write_text("\n".join(output).rstrip() + ("\n" if output else ""))
loader = kaku_dir / "kaku-shell-loader.zsh"
if loader.exists():
    lines = [
        line for line in loader.read_text().splitlines()
        if "plugins/codex-self-improvement.zsh" not in line
    ]
    loader.write_text("\n".join(lines).rstrip() + ("\n" if lines else ""))

manifest_path = config_dir / "install-manifest.json"
if manifest_path.exists():
    try:
        manifest = json.loads(manifest_path.read_text())
        backup = manifest.get("interactiveBackup")
        patched_sha = manifest.get("interactivePatchedSha")
        interactive = kaku_dir / "kaku-harness-interactive.zsh"
        if backup and patched_sha and interactive.exists():
            current_sha = hashlib.sha256(interactive.read_bytes()).hexdigest()
            if current_sha == patched_sha and Path(backup).exists():
                shutil.copy2(backup, interactive)
    except Exception:
        pass

wrapper = bin_dir / "codex-harness"
if wrapper.exists() and "Managed by Codex Self Improvement" in wrapper.read_text(errors="ignore"):
    wrapper.unlink()
alias = bin_dir / "cxh"
if alias.is_symlink() and alias.readlink() == Path("codex-harness"):
    alias.unlink()
for path in [
    config_dir / "env.zsh",
    config_dir / "install-manifest.json",
    kaku_dir / "codex-self-improvement.zsh",
]:
    if path.exists() or path.is_symlink():
        path.unlink()
