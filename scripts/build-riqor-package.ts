import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { runProcess } from "../src/process";

export type BuildOptions = Readonly<{
  repositoryRoot?: string;
  packageRoot?: string;
  sourceDateEpoch?: number;
}>;

export type BuildReport = Readonly<{
  packageRoot: string;
  version: string;
  sourceCommit: string;
  files: readonly { path: string; sha256: string; bytes: number }[];
}>;

export function isPortableRuntimePath(path: string) {
  const name = basename(path);
  return name !== ".DS_Store" && name !== "Thumbs.db" && !name.startsWith("._");
}

const staticRuntimeFiles = [
  "plugins/riqor/.codex-plugin/plugin.json",
  "plugins/riqor/package.json",
  "plugins/riqor/assets",
  "plugins/riqor/skills",
  "config/shell",
  ".agents/plugins/marketplace.json",
  "skills-lock.json",
  "config/skill-curation.json",
  "skills/riqor-pack",
  "scripts/install-shell-integration.sh",
  "scripts/uninstall-shell-integration.sh",
  "scripts/install-shell-integration.py",
  "scripts/uninstall-shell-integration.py",
  "scripts/install-plugin.sh",
  "scripts/uninstall-plugin.sh",
  "scripts/check-marketplace-source.py",
] as const;

export async function buildRiqorPackage(options: BuildOptions = {}): Promise<BuildReport> {
  const repositoryRoot = resolve(options.repositoryRoot ?? resolve(import.meta.dir, ".."));
  const packageRoot = resolve(options.packageRoot ?? join(repositoryRoot, "packages", "riqor"));
  const runtimeRoot = join(packageRoot, "runtime");

  const pkgJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")) as { version: string };
  const version = pkgJson.version;

  const gitCommit = (await runProcess(["git", "rev-parse", "HEAD"], { cwd: repositoryRoot })).stdout.trim();
  const sourceDateEpoch = options.sourceDateEpoch ?? Number((await runProcess(["git", "show", "-s", "--format=%ct", "HEAD"], { cwd: repositoryRoot })).stdout.trim() || Date.now());

  // Reset runtime and dist directories
  await rm(join(packageRoot, "dist"), { recursive: true, force: true });
  await rm(runtimeRoot, { recursive: true, force: true });
  await mkdir(join(packageRoot, "dist"), { recursive: true });
  await mkdir(runtimeRoot, { recursive: true });

  // 1. Build CLI bundle for Node
  const cliBuild = await runProcess(
    ["bun", "build", join(packageRoot, "src", "cli.ts"), "--target=node", "--format=esm", `--outfile=${join(packageRoot, "dist", "cli.mjs")}`],
    { cwd: repositoryRoot }
  );
  if (cliBuild.exitCode !== 0) throw new Error(`CLI build failed: ${cliBuild.stderr}`);

  // 2. Build Hook bundle for Node
  const hookDir = join(runtimeRoot, "plugins", "riqor", "hooks");
  await mkdir(hookDir, { recursive: true });
  const hookBuild = await runProcess(
    ["bun", "build", join(repositoryRoot, "plugins", "riqor", "hooks", "main.ts"), "--target=node", "--format=esm", `--outfile=${join(hookDir, "main.mjs")}`],
    { cwd: repositoryRoot }
  );
  if (hookBuild.exitCode !== 0) throw new Error(`Hook build failed: ${hookBuild.stderr}`);

  // 3. Copy static runtime files
  for (const item of staticRuntimeFiles) {
    const srcPath = join(repositoryRoot, item);
    const destPath = join(runtimeRoot, item);
    await mkdir(dirname(destPath), { recursive: true });
    await cp(srcPath, destPath, { recursive: true, filter: (source) => isPortableRuntimePath(source) });
  }

  // 4. Generate packaged hooks.json
  const sourceHooksJson = JSON.parse(await readFile(join(repositoryRoot, "plugins", "riqor", "hooks", "hooks.json"), "utf8")) as { hooks: Record<string, Array<{ type: string; command: string }>> };
  const packagedHooksJson = {
    hooks: Object.fromEntries(
      Object.entries(sourceHooksJson.hooks).map(([event, steps]) => [
        event,
        steps.map((step) => ({
          ...step,
          command: `node "\${PLUGIN_ROOT}/hooks/main.mjs"`,
        })),
      ])
    ),
  };
  await writeFile(join(hookDir, "hooks.json"), JSON.stringify(packagedHooksJson, null, 2) + "\n");

  // 5. Copy root LICENSE to package root
  const rootLicense = join(repositoryRoot, "LICENSE");
  try {
    await cp(rootLicense, join(packageRoot, "LICENSE"));
  } catch {
    // Write default LICENSE if root LICENSE not created yet
    await writeFile(join(packageRoot, "LICENSE"), "MIT License\n\nCopyright (c) 2026 Mamdouh Aboammar\n");
  }

  // 6. Compute file hashes for provenance.json
  async function collectFiles(dir: string): Promise<string[]> {
    const entries = await (await import("node:fs/promises")).readdir(dir, { withFileTypes: true });
    const paths: string[] = [];
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) paths.push(...await collectFiles(fullPath));
      else if (entry.isFile() && entry.name !== ".DS_Store") paths.push(fullPath);
    }
    return paths;
  }

  const runtimeFilePaths = await collectFiles(runtimeRoot);
  const fileRecords = await Promise.all(
    runtimeFilePaths.sort().map(async (filePath) => {
      const content = await readFile(filePath);
      const sha256 = createHash("sha256").update(content).digest("hex");
      return {
        path: relative(runtimeRoot, filePath),
        sha256,
        bytes: content.length,
      };
    })
  );

  const provenance = {
    version,
    sourceCommit: gitCommit,
    sourceDateEpoch,
    files: fileRecords,
  };
  await writeFile(join(runtimeRoot, "provenance.json"), JSON.stringify(provenance, null, 2) + "\n");

  return {
    packageRoot,
    version,
    sourceCommit: gitCommit,
    files: fileRecords,
  };
}

if (import.meta.main) {
  const report = await buildRiqorPackage();
  console.log(`Built Riqor package v${report.version} (${report.files.length} runtime files)`);
}
