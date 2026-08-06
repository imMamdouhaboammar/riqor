import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { install } from "../src/commands/install";
import { uninstall } from "../src/commands/uninstall";

const repositoryRoot = resolve(import.meta.dir, "..", "..", "..");

describe("tarball installation and uninstallation", () => {
  test("installs versioned runtime payload to custom home directory", async () => {
    const tempHome = await mkdtemp(join(tmpdir(), "riqor-test-home-"));
    const report = await install({ home: tempHome });

    expect(report.ok).toBe(true);
    expect(report.version).toBe("0.1.0");
    expect(report.surfaces).toContain(join(tempHome, ".local", "bin", "riqor"));

    const uninstallReport = await uninstall({ home: tempHome });
    expect(uninstallReport.ok).toBe(true);

    await rm(tempHome, { recursive: true, force: true });
  }, 15000);
});
