import { describe, expect, test } from "bun:test";
import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
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
    expect(report.surfaces).toContain("codex-agents");
    const profile = await readFile(join(tempHome, ".codex", "riqor.config.toml"), "utf8");
    expect(profile).toStartWith("# Managed by Riqor\n");
    expect(profile).toContain("[agents.engineering-senior-developer]");
    await access(join(tempHome, ".codex", "riqor-agents", "engineering-senior-developer.toml"));

    const uninstallReport = await uninstall({ home: tempHome });
    expect(uninstallReport.ok).toBe(true);
    await expect(access(join(tempHome, ".codex", "riqor.config.toml"))).rejects.toThrow();
    await expect(access(join(tempHome, ".codex", "riqor-agents"))).rejects.toThrow();

    await rm(tempHome, { recursive: true, force: true });
  }, 15000);
});
