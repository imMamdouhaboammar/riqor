import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { install } from "../src/commands/install";
import { uninstall } from "../src/commands/uninstall";

const repositoryRoot = resolve(import.meta.dir, "..", "..", "..");
const packageRoot = resolve(import.meta.dir, "..");
const packageVersion = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")).version as string;

describe("tarball installation and uninstallation", () => {
  test("installs versioned runtime payload to custom home directory", async () => {
    const tempHome = await mkdtemp(join(tmpdir(), "riqor-test-home-"));
    const report = await install({ home: tempHome });

    expect(report.ok).toBe(true);
    expect(report.version).toBe(packageVersion);
    expect(report.surfaces).toContain(join(tempHome, ".local", "bin", "riqor"));

    const uninstallReport = await uninstall({ home: tempHome });
    expect(uninstallReport.ok).toBe(true);

    await rm(tempHome, { recursive: true, force: true });
  }, 15000);
});
