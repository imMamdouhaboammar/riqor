import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolveUserPaths } from "../paths";
import { runCommand } from "../process";
import { CheckRecord, InstallOptions, InstallReport } from "../types";
import { doctor } from "./doctor";

export async function install(options: InstallOptions = {}): Promise<InstallReport> {
  const paths = resolveUserPaths(options.home);
  const packageRoot = process.env.RIQOR_PACKAGE_ROOT ?? join(dirname(import.meta.url.replace(/^file:\/\//, "")), "..", "..");
  const pkgJsonPath = join(packageRoot, "package.json");

  const pkg = JSON.parse(await readFile(pkgJsonPath, "utf8")) as { version: string };
  const version = pkg.version;

  const versionedDataDir = join(paths.riqorDataDir, version);
  const stagingDir = join(paths.riqorStateDir, `install-staging-${randomUUID()}`);

  const checks: CheckRecord[] = [];
  const surfaces: string[] = [];

  // 1. Copy payload to staging then to versioned data directory
  await mkdir(stagingDir, { recursive: true });
  await cp(packageRoot, stagingDir, { recursive: true });

  await mkdir(dirname(versionedDataDir), { recursive: true });
  await rm(versionedDataDir, { recursive: true, force: true });
  await cp(stagingDir, versionedDataDir, { recursive: true });
  await rm(stagingDir, { recursive: true, force: true });
  checks.push({ id: "copy-payload", ok: true, detail: versionedDataDir });

  // 2. Update atomic current symlink
  await rm(paths.riqorCurrentLink, { force: true });
  await symlink(versionedDataDir, paths.riqorCurrentLink);
  checks.push({ id: "atomic-current-link", ok: true, detail: paths.riqorCurrentLink });

  // 3. Create executable shims
  await mkdir(paths.binDir, { recursive: true });
  const shimContent = `#!/usr/bin/env bash\n# Managed by Riqor\nset -euo pipefail\nexec node "${join(paths.riqorCurrentLink, "bin", "riqor.mjs")}" "$@"\n`;
  await writeFile(paths.riqorBinShim, shimContent, { mode: 0o755 });
  surfaces.push(paths.riqorBinShim);

  for (const aliasPath of [paths.codexHarnessAlias, paths.cxhAlias]) {
    await rm(aliasPath, { force: true });
    await symlink("riqor", aliasPath);
    surfaces.push(aliasPath);
  }
  checks.push({ id: "executable-shims", ok: true, detail: paths.binDir });

  // 4. Install shell integration if Python available
  const pyInstall = join(versionedDataDir, "runtime", "scripts", "install-shell-integration.py");
  const pyResult = await runCommand(["python3", pyInstall], {
    env: {
      HOME: paths.home,
      ROOT: join(versionedDataDir, "runtime"),
      SHELL_TEMPLATES_DIR: join(versionedDataDir, "runtime", "config", "shell"),
      CONFIG_DIR: paths.riqorConfigDir,
      KAKU_PLUGIN_DIR: join(paths.home, ".config", "kaku", "zsh", "plugins"),
      BIN_DIR: paths.binDir,
      BACKUP_DIR: join(paths.riqorConfigDir, "backups"),
    },
  });
  if (pyResult.exitCode === 0) {
    surfaces.push("shell-integration");
  }

  // 5. Write install manifest
  await mkdir(paths.riqorConfigDir, { recursive: true });
  const manifest = {
    version,
    installedAt: new Date().toISOString(),
    packageRoot: versionedDataDir,
    surfaces,
  };
  await writeFile(paths.installManifestPath, JSON.stringify(manifest, null, 2) + "\n");
  checks.push({ id: "install-manifest", ok: true, detail: paths.installManifestPath });

  const doctorRes = await doctor(options);

  return {
    ok: checks.every((c) => c.ok),
    version,
    surfaces,
    manifestPath: paths.installManifestPath,
    rollbackCommand: "riqor uninstall",
    checks,
  };
}
