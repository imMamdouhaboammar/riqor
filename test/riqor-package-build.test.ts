import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildRiqorPackage } from "../scripts/build-riqor-package";

const repositoryRoot = resolve(import.meta.dir, "..");
const packageRoot = join(repositoryRoot, "packages", "riqor");

describe("riqor package build", () => {
  test("package.json metadata matches expected shape", async () => {
    const pkg = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    expect(pkg).toMatchObject({
      name: "riqor",
      version: "0.1.0",
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
    const report = await buildRiqorPackage({ repositoryRoot, packageRoot });
    expect(report.version).toBe("0.1.0");
    expect(report.files.length).toBeGreaterThan(5);

    const provenance = JSON.parse(await readFile(join(packageRoot, "runtime", "provenance.json"), "utf8"));
    expect(provenance.version).toBe("0.1.0");
    expect(provenance.sourceCommit).toBeString();
    expect(provenance.files).toBeArray();
  });
});
