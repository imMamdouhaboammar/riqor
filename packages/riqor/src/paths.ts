import { homedir } from "node:os";
import { join, resolve } from "node:path";

export function resolveUserPaths(customHome?: string) {
  const home = customHome ? resolve(customHome) : homedir();
  const useProcessXdg = customHome === undefined;
  const xdgData = useProcessXdg && process.env.XDG_DATA_HOME
    ? resolve(process.env.XDG_DATA_HOME)
    : join(home, ".local", "share");
  const xdgConfig = useProcessXdg && process.env.XDG_CONFIG_HOME
    ? resolve(process.env.XDG_CONFIG_HOME)
    : join(home, ".config");
  const xdgState = useProcessXdg && process.env.XDG_STATE_HOME
    ? resolve(process.env.XDG_STATE_HOME)
    : join(home, ".local", "state");

  const riqorDataDir = join(xdgData, "riqor");
  const riqorCurrentLink = join(riqorDataDir, "current");
  const riqorConfigDir = join(xdgConfig, "riqor");
  const riqorStateDir = join(xdgState, "riqor");
  const shellConfigDir = join(xdgConfig, "codex-self-improvement");
  const installManifestPath = join(riqorConfigDir, "install-manifest.json");

  const binDir = join(home, ".local", "bin");
  const riqorBinShim = join(binDir, "riqor");
  const codexHarnessAlias = join(binDir, "codex-harness");
  const cxhAlias = join(binDir, "cxh");
  return {
    home,
    xdgData,
    xdgConfig,
    xdgState,
    binDir,
    riqorDataDir,
    riqorCurrentLink,
    riqorConfigDir,
    riqorStateDir,
    shellConfigDir,
    installManifestPath,
    riqorBinShim,
    codexHarnessAlias,
    cxhAlias,
  };
}
