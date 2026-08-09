import { describe, expect, test } from "bun:test";
import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildRiqorPackage, isPortableRuntimePath } from "../scripts/build-riqor-package";

const repositoryRoot = resolve(import.meta.dir, "..");
const packageRoot = join(repositoryRoot, "packages", "riqor");

describe("riqor package build", () => {
  test("runtime packaging rejects operating-system metadata paths", () => {
    expect(isPortableRuntimePath("/repo/skills/example/SKILL.md")).toBe(true);
    expect(isPortableRuntimePath("/repo/skills/example/.DS_Store")).toBe(false);
    expect(isPortableRuntimePath("/repo/skills/example/Thumbs.db")).toBe(false);
    expect(isPortableRuntimePath("/repo/skills/example/._SKILL.md")).toBe(false);
  });

  test("package.json metadata matches expected shape", async () => {
    const pkg = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    expect(pkg).toMatchObject({
      name: "riqor",
      version: pkg.version,
      type: "module",
      bin: {
        riqor: "bin/riqor.mjs",
        "codex-harness": "bin/riqor.mjs",
        cxh: "bin/riqor.mjs",
      },
      engines: { node: ">=22" },
    });
    expect(pkg.files).toEqual(["bin", "dist", "runtime", "README.md", "LICENSE"]);
  });

  test("buildRiqorPackage generates runtime payload and provenance", async () => {
    const pkg = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    const report = await buildRiqorPackage({ repositoryRoot, packageRoot });
    expect(report.version).toBe(pkg.version);
    expect(report.files.length).toBeGreaterThan(5);

    const provenance = JSON.parse(await readFile(join(packageRoot, "runtime", "provenance.json"), "utf8"));
    expect(provenance.version).toBe(pkg.version);
    expect(provenance.sourceCommit).toBeString();
    expect(provenance.files).toBeArray();
    await access(join(packageRoot, "runtime", "scripts", "install-shell-integration.sh"));
    await access(join(packageRoot, "runtime", "scripts", "uninstall-shell-integration.sh"));
    await access(join(packageRoot, "runtime", "scripts", "install-plugin.sh"));
    await access(join(packageRoot, "runtime", "scripts", "check-marketplace-source.py"));
    await access(join(packageRoot, "runtime", "plugins", "riqor", ".codex", "riqor.config.toml"));
    await access(join(packageRoot, "runtime", "plugins", "riqor", ".codex", "agents", "engineering-senior-developer.toml"));
  });
});
