import { access, lstat, readFile, readdir, readlink, rm, rmdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { classifyManagedPath } from "../managed-paths";
import { resolveUserPaths } from "../paths";
import { runCommand } from "../process";
import { CheckRecord, UninstallOptions, UninstallReport } from "../types";

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isInside(parent: string, child: string) {
  const rel = relative(resolve(parent), resolve(child));
  return rel !== "" && !rel.startsWith("..") && !rel.startsWith("/");
}

export async function uninstall(options: UninstallOptions = {}): Promise<UninstallReport> {
  const paths = resolveUserPaths(options.home);
  const removed: string[] = [];
  const restored: string[] = [];
  const preserved: string[] = [];
  const checks: CheckRecord[] = [];

  let installedSurfaces: string[] = [];
  try {
    const manifest = JSON.parse(await readFile(paths.installManifestPath, "utf8")) as { surfaces?: unknown };
    if (Array.isArray(manifest.surfaces)) installedSurfaces = manifest.surfaces.filter((item): item is string => typeof item === "string");
  } catch {}

  if (installedSurfaces.includes("codex-plugin")) {
    const codexHome = options.codexHome ? resolve(options.codexHome) : join(paths.home, ".codex");
    const codexEnv = {
      HOME: paths.home,
      CODEX_HOME: codexHome,
      XDG_CONFIG_HOME: paths.xdgConfig,
      XDG_DATA_HOME: paths.xdgData,
      XDG_STATE_HOME: paths.xdgState,
      RIQOR_RUNTIME_ROOT: join(paths.riqorCurrentLink, "runtime"),
      CODEX_SELF_IMPROVEMENT_PACKAGE_MODE: "1",
    };
    const pluginUninstaller = join(paths.riqorCurrentLink, "runtime", "scripts", "uninstall-plugin.sh");
    const codex = await runCommand(["codex", "--version"], { env: codexEnv, timeoutMs: 5000 });
    if (codex.exitCode !== 0 || !(await exists(pluginUninstaller))) {
      checks.push({ id: "codex-plugin", ok: false, detail: codex.exitCode !== 0 ? "Codex CLI unavailable; plugin registration was preserved" : "plugin uninstaller is missing" });
      preserved.push("codex-plugin registration");
    } else {
      const plugin = await runCommand(["bash", pluginUninstaller, "--remove-marketplace"], { env: codexEnv, timeoutMs: 30000 });
      checks.push({ id: "codex-plugin", ok: plugin.exitCode === 0, detail: plugin.exitCode === 0 ? "removed" : plugin.stderr || "plugin uninstaller failed" });
      if (plugin.exitCode === 0) removed.push("codex-plugin registration");
    }
  } else {
    checks.push({ id: "codex-plugin", ok: true, detail: "not recorded as installed" });
  }

  const shellUninstaller = join(paths.riqorCurrentLink, "runtime", "scripts", "uninstall-shell-integration.sh");
  if (await exists(shellUninstaller)) {
    const shell = await runCommand(["bash", shellUninstaller], {
      env: {
        HOME: paths.home,
        XDG_CONFIG_HOME: paths.xdgConfig,
        XDG_DATA_HOME: paths.xdgData,
        XDG_STATE_HOME: paths.xdgState,
        CODEX_SELF_IMPROVEMENT_PACKAGE_MODE: "1",
      },
      timeoutMs: 30000,
    });
    checks.push({ id: "shell-integration", ok: shell.exitCode === 0, detail: shell.exitCode === 0 ? "removed" : shell.stderr || "uninstaller failed" });
    if (shell.exitCode === 0) restored.push("shell-integration");
  } else {
    checks.push({ id: "shell-integration", ok: true, detail: "not installed" });
  }
  const targets = [
    { path: paths.riqorBinShim, primary: true },
    { path: paths.codexHarnessAlias, primary: false },
    { path: paths.cxhAlias, primary: false },
  ];
  for (const target of targets) {
    const kind = await classifyManagedPath(target.path);
    const owned = target.primary
      ? kind === "riqor-managed" || kind === "absent"
      : kind === "riqor-alias" || kind === "legacy-managed" || kind === "riqor-managed" || kind === "absent";
    if (!owned) {
      preserved.push(target.path);
      checks.push({ id: `preserve-${target.path.split("/").pop()}`, ok: false, detail: `foreign path preserved: ${target.path}` });
      continue;
    }
    if (kind !== "absent") {
      await rm(target.path, { force: true });
      removed.push(target.path);
    }
  }

  try {
    const currentStat = await lstat(paths.riqorCurrentLink);
    if (currentStat.isSymbolicLink()) {
      const target = await readlink(paths.riqorCurrentLink);
      const resolvedTarget = resolve(paths.riqorDataDir, target);
      if (isInside(paths.riqorDataDir, resolvedTarget)) {
        await rm(paths.riqorCurrentLink, { force: true });
        removed.push(paths.riqorCurrentLink);
      } else {
        preserved.push(paths.riqorCurrentLink);
        checks.push({ id: "current-link", ok: false, detail: "foreign current link preserved" });
      }
    } else {
      preserved.push(paths.riqorCurrentLink);
      checks.push({ id: "current-link", ok: false, detail: "non-symlink current path preserved" });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (await exists(paths.riqorDataDir)) {
    for (const entry of await readdir(paths.riqorDataDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const payload = join(paths.riqorDataDir, entry.name);
      try {
        const pkg = JSON.parse(await readFile(join(payload, "package.json"), "utf8")) as { name?: string; version?: string };
        if (pkg.name === "riqor" && pkg.version === entry.name) {
          await rm(payload, { recursive: true, force: true });
          removed.push(payload);
        }
      } catch {}
    }
    try { await rmdir(paths.riqorDataDir); } catch {}
  }

  if (await exists(paths.installManifestPath)) {
    await rm(paths.installManifestPath, { force: true });
    removed.push(paths.installManifestPath);
  }
  try { await rmdir(paths.riqorConfigDir); } catch {}

  if (!checks.some((check) => check.id === "current-link")) {
    checks.push({ id: "current-link", ok: true, detail: "removed or absent" });
  }
  return {
    ok: checks.every((check) => check.ok),
    removed,
    restored,
    preserved,
    checks,
  };
}
