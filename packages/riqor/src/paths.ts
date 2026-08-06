import { homedir } from "node:os";
import { join, resolve } from "node:path";

export function resolveUserPaths(customHome?: string) {
  const home = customHome ? resolve(customHome) : homedir();
  const xdgData = process.env.XDG_DATA_HOME ? resolve(process.env.XDG_DATA_HOME) : join(home, ".local", "share");
  const xdgConfig = process.env.XDG_CONFIG_HOME ? resolve(process.env.XDG_CONFIG_HOME) : join(home, ".config");
  const xdgState = process.env.XDG_STATE_HOME ? resolve(process.env.XDG_STATE_HOME) : join(home, ".local", "state");

  const riqorDataDir = join(xdgData, "riqor");
  const riqorCurrentLink = join(riqorDataDir, "current");
  const riqorConfigDir = join(xdgConfig, "riqor");
  const riqorStateDir = join(xdgState, "riqor");
  const installManifestPath = join(riqorConfigDir, "install-manifest.json");

  const binDir = join(home, ".local", "bin");
  const riqorBinShim = join(binDir, "riqor");
  const codexHarnessAlias = join(binDir, "codex-harness");
  const cxhAlias = join(binDir, "cxh");

  return {
    home,
    binDir,
    riqorDataDir,
    riqorCurrentLink,
    riqorConfigDir,
    riqorStateDir,
    installManifestPath,
    riqorBinShim,
    codexHarnessAlias,
    cxhAlias,
  };
}
