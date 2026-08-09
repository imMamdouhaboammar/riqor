import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyManagedPath } from "../managed-paths";
import { resolveUserPaths } from "../paths";
import { runCommand } from "../process";
import { CheckRecord, InstallOptions, InstallReport } from "../types";
import { installRiqorAgentProfile } from "../codex-agents";
import { doctor } from "./doctor";

function modulePackageRoot() {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function canReplacePrimary(kind: Awaited<ReturnType<typeof classifyManagedPath>>) {
  return kind === "absent" || kind === "riqor-managed";
}

function canReplaceAlias(kind: Awaited<ReturnType<typeof classifyManagedPath>>) {
  return kind === "absent" || kind === "riqor-alias" || kind === "legacy-managed" || kind === "riqor-managed";
}

export async function install(options: InstallOptions = {}): Promise<InstallReport> {
  const paths = resolveUserPaths(options.home);
  const packageRoot = process.env.RIQOR_PACKAGE_ROOT ?? modulePackageRoot();
  const checks: CheckRecord[] = [];
  const surfaces: string[] = [];
  let version = "unknown";

  try {
    const pkg = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")) as { version?: string };
    if (!pkg.version) throw new Error("package version is missing");
    version = pkg.version;
    checks.push({ id: "package-metadata", ok: true, detail: version });
  } catch (error) {
    checks.push({ id: "package-metadata", ok: false, detail: error instanceof Error ? error.message : "unreadable" });
    return { ok: false, version, surfaces, manifestPath: paths.installManifestPath, rollbackCommand: "riqor uninstall", checks };
  }
  const supportedPlatform = process.platform === "darwin" || process.platform === "linux";
  checks.push({ id: "supported-platform", ok: supportedPlatform, detail: process.platform });
  if (!supportedPlatform) {
    return { ok: false, version, surfaces, manifestPath: paths.installManifestPath, rollbackCommand: "riqor uninstall", checks };
  }

  const ownership = await Promise.all([
    classifyManagedPath(paths.riqorBinShim),
    classifyManagedPath(paths.codexHarnessAlias),
    classifyManagedPath(paths.cxhAlias),
  ]);
  const ownershipOk = canReplacePrimary(ownership[0]) && canReplaceAlias(ownership[1]) && canReplaceAlias(ownership[2]);
  checks.push({
    id: "managed-bin-paths",
    ok: ownershipOk,
    detail: ownershipOk ? "available or Riqor-managed" : `riqor=${ownership[0]}, codex-harness=${ownership[1]}, cxh=${ownership[2]}`,
  });
  if (!ownershipOk) {
    return { ok: false, version, surfaces, manifestPath: paths.installManifestPath, rollbackCommand: "riqor uninstall", checks };
  }

  const versionedDataDir = join(paths.riqorDataDir, version);
  const stagingDir = join(paths.riqorDataDir, `.install-staging-${randomUUID()}`);
  await mkdir(paths.riqorDataDir, { recursive: true });
  try {
    await cp(packageRoot, stagingDir, { recursive: true });
    await rm(versionedDataDir, { recursive: true, force: true });
    await rename(stagingDir, versionedDataDir);
    checks.push({ id: "copy-payload", ok: true, detail: versionedDataDir });
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }

  const temporaryLink = join(paths.riqorDataDir, `.current-${randomUUID()}`);
  try {
    await symlink(versionedDataDir, temporaryLink);
    await rename(temporaryLink, paths.riqorCurrentLink);
    checks.push({ id: "atomic-current-link", ok: true, detail: paths.riqorCurrentLink });
  } finally {
    await rm(temporaryLink, { force: true });
  }
  await mkdir(paths.binDir, { recursive: true });
  const shimContent = `#!/usr/bin/env bash\n# Managed by Riqor\nset -euo pipefail\nexec node "${join(paths.riqorCurrentLink, "bin", "riqor.mjs")}" "$@"\n`;
  await rm(paths.riqorBinShim, { force: true });
  await writeFile(paths.riqorBinShim, shimContent, { mode: 0o755 });
  surfaces.push(paths.riqorBinShim);

  for (const aliasPath of [paths.codexHarnessAlias, paths.cxhAlias]) {
    await rm(aliasPath, { force: true });
    await symlink("riqor", aliasPath);
    surfaces.push(aliasPath);
  }
  checks.push({ id: "executable-shims", ok: true, detail: paths.binDir });

  const shellInstaller = join(versionedDataDir, "runtime", "scripts", "install-shell-integration.sh");
  const shellResult = await runCommand(["bash", shellInstaller], {
    env: {
      HOME: paths.home,
      XDG_CONFIG_HOME: paths.xdgConfig,
      XDG_DATA_HOME: paths.xdgData,
      XDG_STATE_HOME: paths.xdgState,
      CODEX_SELF_IMPROVEMENT_PACKAGE_MODE: "1",
    },
    timeoutMs: 30000,
  });
  const shellOk = shellResult.exitCode === 0;
  checks.push({
    id: "shell-integration",
    ok: shellOk,
    detail: shellOk ? "installed" : shellResult.stderr || "installer failed",
  });
  if (shellOk) surfaces.push("shell-integration");

  const codexHome = options.codexHome ? resolve(options.codexHome) : join(paths.home, ".codex");
  await mkdir(codexHome, { recursive: true, mode: 0o700 });
  const agentProfile = await installRiqorAgentProfile({
    codexHome,
    sourceCodexDir: join(versionedDataDir, "runtime", "plugins", "riqor", ".codex"),
  });
  checks.push({
    id: "codex-agents",
    ok: agentProfile.ok,
    detail: agentProfile.ok ? `installed ${agentProfile.agentCount} native agents` : agentProfile.error ?? "agent profile install failed",
  });
  if (agentProfile.ok) surfaces.push("codex-agents");

  const codexEnv = {
    HOME: paths.home,
    CODEX_HOME: codexHome,
    XDG_CONFIG_HOME: paths.xdgConfig,
    XDG_DATA_HOME: paths.xdgData,
    XDG_STATE_HOME: paths.xdgState,
    RIQOR_RUNTIME_ROOT: join(versionedDataDir, "runtime"),
    CODEX_SELF_IMPROVEMENT_PACKAGE_MODE: "1",
  };
  const codex = await runCommand(["codex", "--version"], { env: codexEnv, timeoutMs: 5000 });
  if (codex.exitCode !== 0) {
    checks.push({ id: "codex-plugin", ok: true, detail: "skipped: Codex CLI unavailable; run riqor plugin install after Codex is installed" });
  } else {
    const pluginInstaller = join(versionedDataDir, "runtime", "scripts", "install-plugin.sh");
    const pluginResult = await runCommand(["bash", pluginInstaller], { env: codexEnv, timeoutMs: 30000 });
    const pluginOk = pluginResult.exitCode === 0;
    checks.push({ id: "codex-plugin", ok: pluginOk, detail: pluginOk ? "installed" : pluginResult.stderr || "plugin installer failed" });
    if (pluginOk) surfaces.push("codex-plugin");
  }

  await mkdir(paths.riqorConfigDir, { recursive: true });
  const manifest = {
    version,
    installedAt: new Date().toISOString(),
    packageRoot: versionedDataDir,
    surfaces,
  };
  await writeFile(paths.installManifestPath, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
  checks.push({ id: "install-manifest", ok: true, detail: paths.installManifestPath });
  const packageDoctor = await doctor({ ...options, packageOnly: true });
  for (const check of packageDoctor.checks) {
    checks.push({ ...check, id: `doctor-${check.id}` });
  }

  return {
    ok: checks.every((check) => check.ok),
    version,
    surfaces,
    manifestPath: paths.installManifestPath,
    rollbackCommand: "riqor uninstall",
    checks,
  };
}
