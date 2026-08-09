import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildRiqorPackage } from "../scripts/build-riqor-package";
import { inspectRiqorTarball } from "../scripts/inspect-riqor-tarball";
import { runProcess } from "../src/process";

const repositoryRoot = resolve(import.meta.dir, "..");
const packageRoot = join(repositoryRoot, "packages", "riqor");
const packageVersion = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")).version as string;

describe("riqor tarball inspection", () => {
  test("inspectRiqorTarball verifies compiled tarball entries", async () => {
    await buildRiqorPackage({ repositoryRoot, packageRoot });
    const packResult = await runProcess(["npm", "pack", "--json"], { cwd: packageRoot });
    expect(packResult.exitCode).toBe(0);

    const packInfo = JSON.parse(packResult.stdout) as Array<{ filename: string }>;
    const tarballName = packInfo[0]?.filename ?? `riqor-${packageVersion}.tgz`;
    const tarballPath = join(packageRoot, tarballName);

    const report = await inspectRiqorTarball(tarballPath);
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.entries).toContain("bin/riqor.mjs");
    expect(report.entries).toContain("dist/cli.mjs");
    expect(report.entries).toContain("runtime/scripts/install-shell-integration.sh");
    expect(report.entries).toContain("runtime/scripts/uninstall-shell-integration.py");
    expect(report.entries).toContain("runtime/scripts/install-plugin.sh");

    await rm(tarballPath, { force: true });
  }, 15000);
});
