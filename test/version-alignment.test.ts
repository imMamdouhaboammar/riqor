import { describe, expect, test } from "bun:test";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createReleaseManifest } from "../scripts/create-release-manifest";

const root = resolve(import.meta.dir, "..");

describe("Riqor version alignment", () => {
  test("npm package, repository version, and release notes stay aligned", async () => {
    const npmPackage = JSON.parse(await readFile(join(root, "packages", "riqor", "package.json"), "utf8"));
    const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    const version = npmPackage.version as string;
    const releaseNotes = await readFile(join(root, "docs", "releases", `${version}.md`), "utf8");

    expect(rootPackage.version).toBe(version);
    expect(releaseNotes).toContain(`v${version}`);
  });

  test("Homebrew formula remains internally self-consistent", async () => {
    const formula = await readFile(join(root, "Formula", "riqor.rb"), "utf8");
    const version = formula.match(/version "([^"]+)"/)?.[1];
    expect(version).toBeString();
    expect(formula).toContain(`/download/v${version}/riqor-${version}-homebrew.tar.gz`);
  });
  test("generated release manifest uses the current npm version", async () => {
    const pkg = JSON.parse(await readFile(join(root, "packages", "riqor", "package.json"), "utf8"));
    const version = pkg.version as string;
    const distDir = join(root, "dist");
    await mkdir(distDir, { recursive: true });
    const dummyTarball = join(distDir, `riqor-${version}.tgz`);
    const dummyHomebrew = join(distDir, `riqor-${version}-homebrew.tar.gz`);
    try { await stat(dummyTarball); } catch { await writeFile(dummyTarball, "dummy"); }
    try { await stat(dummyHomebrew); } catch { await writeFile(dummyHomebrew, "dummy"); }

    const manifest = await createReleaseManifest({
      version,
      tag: `v${version}`,
      commit: "0123456789abcdef0123456789abcdef01234567",
      artifactPaths: [dummyTarball, dummyHomebrew],
      outputDir: distDir,
    });

    expect(manifest.version).toBe(version);
    expect(manifest.artifacts.every((artifact) => artifact.file.includes(version))).toBe(true);
  });
});
