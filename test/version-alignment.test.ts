import { describe, expect, test } from "bun:test";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createReleaseManifest } from "../scripts/create-release-manifest";

const root = resolve(import.meta.dir, "..");

describe("Riqor version alignment", () => {
  test("packages, formula, release notes, and manifest report aligned version 0.1.0", async () => {
    const npmPackage = JSON.parse(await readFile(join(root, "packages", "riqor", "package.json"), "utf8"));
    const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    const releaseNotes = await readFile(join(root, "docs", "releases", "0.1.0.md"), "utf8");
    const formula = await readFile(join(root, "Formula", "riqor.rb"), "utf8");

    expect(npmPackage.version).toBe("0.1.0");
    expect(rootPackage.version).toBe("0.1.0");
    expect(releaseNotes).toContain("v0.1.0");
    expect(formula).toContain('version "0.1.0"');
  });

  test("generated release-manifest.json artifacts align with version 0.1.0", async () => {
    const distDir = join(root, "dist");
    await mkdir(distDir, { recursive: true });
    const dummyTarball = join(distDir, "riqor-0.1.0.tgz");
    const dummyHomebrew = join(distDir, "riqor-0.1.0-homebrew.tar.gz");
    try { await stat(dummyTarball); } catch { await writeFile(dummyTarball, "dummy"); }
    try { await stat(dummyHomebrew); } catch { await writeFile(dummyHomebrew, "dummy"); }

    const manifest = await createReleaseManifest({
      version: "0.1.0",
      tag: "v0.1.0",
      commit: "0123456789abcdef0123456789abcdef01234567",
      artifactPaths: [dummyTarball, dummyHomebrew],
      outputDir: distDir,
    });

    expect(manifest.version).toBe("0.1.0");
    expect(manifest.artifacts.every((artifact) => artifact.file.includes("0.1.0"))).toBe(true);
  });
});
