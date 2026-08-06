import { readFile, rm } from "node:fs/promises";
import { resolveUserPaths } from "../paths";
import { runCommand } from "../process";
import { UninstallOptions, UninstallReport } from "../types";

export async function uninstall(options: UninstallOptions = {}): Promise<UninstallReport> {
  const paths = resolveUserPaths(options.home);
  const removed: string[] = [];
  const restored: string[] = [];

  // Remove bin shims and aliases
  for (const p of [paths.riqorBinShim, paths.codexHarnessAlias, paths.cxhAlias]) {
    try {
      await rm(p, { force: true });
      removed.push(p);
    } catch {}
  }

  // Run shell integration uninstaller if present
  try {
    const pyUninstall = `${paths.riqorCurrentLink}/runtime/scripts/uninstall-shell-integration.py`;
    await runCommand(["python3", pyUninstall], {
      env: {
        HOME: paths.home,
        CONFIG_DIR: paths.riqorConfigDir,
        KAKU_PLUGIN_DIR: `${paths.home}/.config/kaku/zsh/plugins`,
        BIN_DIR: paths.binDir,
      },
    });
  } catch {}

  // Remove current link and versioned data directory
  try {
    await rm(paths.riqorCurrentLink, { force: true });
    removed.push(paths.riqorCurrentLink);
    await rm(paths.riqorDataDir, { recursive: true, force: true });
    removed.push(paths.riqorDataDir);
  } catch {}

  // Remove manifest
  try {
    await rm(paths.installManifestPath, { force: true });
    removed.push(paths.installManifestPath);
  } catch {}

  return {
    ok: true,
    removed,
    restored,
  };
}
