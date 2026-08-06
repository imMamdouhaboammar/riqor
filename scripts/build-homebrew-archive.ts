import { mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export async function buildHomebrewArchive(): Promise<{ archivePath: string; version: string }> {
  const root = resolve(import.meta.dir, "..");
  const riqorPkgDir = join(root, "packages", "riqor");
  const distDir = join(root, "dist");

  // Ensure riqor package build ran
  const buildResult = spawnSync("bun", ["run", "scripts/build-riqor-package.ts"], { cwd: root, stdio: "inherit" });
  if (buildResult.status !== 0) {
    throw new Error("Failed to build Riqor package prior to archiving");
  }

  const pkg = JSON.parse(await readFile(join(riqorPkgDir, "package.json"), "utf8")) as { version: string };
  const version = pkg.version;
  const archivePath = join(distDir, `riqor-${version}-homebrew.tar.gz`);

  await mkdir(distDir, { recursive: true });
  await rm(archivePath, { force: true });

  // Create tar.gz directly from packages/riqor root files
  const tarResult = spawnSync(
    "tar",
    ["-czf", archivePath, "bin", "dist", "runtime", "package.json", "README.md", "LICENSE"],
    { cwd: riqorPkgDir, stdio: "inherit" }
  );

  if (tarResult.status !== 0) {
    throw new Error("Failed to create Homebrew archive");
  }

  console.log(`Created Homebrew archive: ${archivePath}`);
  return { archivePath, version };
}

if (import.meta.main) {
  buildHomebrewArchive().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
