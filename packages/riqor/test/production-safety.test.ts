import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { install } from "../src/commands/install";
import { status } from "../src/commands/status";
import { uninstall } from "../src/commands/uninstall";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function tempHome(prefix: string) {
  const home = await mkdtemp(join(tmpdir(), prefix));
  roots.push(home);
  return home;
}

describe("production install safety", () => {
  test("install refuses to overwrite an unrelated riqor executable", async () => {
    const home = await tempHome("riqor-foreign-shim-");
    const binDir = join(home, ".local", "bin");
    const shim = join(binDir, "riqor");
    await mkdir(binDir, { recursive: true });
    await writeFile(shim, "#!/bin/sh\necho foreign\n");
    const report = await install({ home });
    expect(report.ok).toBe(false);
    expect(await readFile(shim, "utf8")).toBe("#!/bin/sh\necho foreign\n");
    expect(await Bun.file(join(home, ".local", "share", "riqor", "current")).exists()).toBe(false);
  });

  test("uninstall preserves unrelated executables", async () => {
    const home = await tempHome("riqor-uninstall-foreign-");
    const binDir = join(home, ".local", "bin");
    await mkdir(binDir, { recursive: true });
    const files = ["riqor", "codex-harness", "cxh"].map((name) => join(binDir, name));
    for (const file of files) await writeFile(file, `foreign:${file}\n`);

    const report = await uninstall({ home });
    expect(report.ok).toBe(false);
    for (const file of files) expect(await Bun.file(file).exists()).toBe(true);
  });

  test("status does not invent versions when the package root is missing", async () => {
    const previous = process.env.RIQOR_PACKAGE_ROOT;
    const missing = join(await tempHome("riqor-status-missing-"), "not-installed");
    process.env.RIQOR_PACKAGE_ROOT = missing;
    try {
      const report = await status({});
      expect(report.version).toBe("missing");
      expect(report.pluginVersion).toBe("missing");
    } finally {
      if (previous === undefined) delete process.env.RIQOR_PACKAGE_ROOT;
      else process.env.RIQOR_PACKAGE_ROOT = previous;
    }
  });
});

describe("0.1.0 migration safety", () => {
  test("install repairs a legacy managed primary shim", async () => {
    const home = await tempHome("riqor-legacy-upgrade-");
    const binDir = join(home, ".local", "bin");
    const shim = join(binDir, "riqor");
    await mkdir(binDir, { recursive: true });
    await writeFile(shim, "#!/bin/sh\n# Managed by Codex Self Improvement\necho legacy\n");

    const report = await install({ home });
    expect(report.ok).toBe(true);
    expect(await readFile(shim, "utf8")).toContain("# Managed by Riqor");
    await uninstall({ home });
  }, 15000);

  test("uninstall removes a legacy managed primary shim", async () => {
    const home = await tempHome("riqor-legacy-uninstall-");
    const shim = join(home, ".local", "bin", "riqor");
    await mkdir(join(home, ".local", "bin"), { recursive: true });
    await writeFile(shim, "#!/bin/sh\n# Managed by Codex Self Improvement\necho legacy\n");

    const report = await uninstall({ home });
    expect(report.ok).toBe(true);
    expect(await Bun.file(shim).exists()).toBe(false);
  });
});

describe("managed marker classification", () => {
  test("a marker outside the executable header does not grant ownership", async () => {
    const home = await tempHome("riqor-late-marker-");
    const shim = join(home, ".local", "bin", "riqor");
    await mkdir(join(home, ".local", "bin"), { recursive: true });
    await writeFile(shim, "#!/bin/sh\necho one\necho two\necho three\necho four\necho five\n# Managed by Riqor\n");

    const report = await install({ home });
    expect(report.ok).toBe(false);
    expect(await readFile(shim, "utf8")).toContain("echo five");
  });
});
