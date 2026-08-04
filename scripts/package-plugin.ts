import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { inspectPlugin } from "./plugin-health";

export function pythonSupportsCompressionLevel(major: number, minor: number) {
  return major > 3 || (major === 3 && minor >= 7);
}

function assertSupportedPython() {
  const execution = Bun.spawnSync(["python3", "-c", "import json,sys; print(json.dumps(list(sys.version_info[:2])))"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (execution.exitCode !== 0) throw new Error(`Python version check failed: ${execution.stderr.toString().trim()}`);
  const version = JSON.parse(execution.stdout.toString()) as [number, number];
  if (!pythonSupportsCompressionLevel(version[0], version[1])) {
    throw new Error(`Python 3.7 or newer is required, found ${version[0]}.${version[1]}`);
  }
}

const python = String.raw`
import os, stat, sys, zipfile
root, output = sys.argv[1], sys.argv[2]
entries = []
for current, dirs, files in os.walk(root):
    dirs[:] = sorted(d for d in dirs if d not in {"node_modules", ".git"})
    for name in sorted(files):
        rel = os.path.relpath(os.path.join(current, name), root).replace(os.sep, "/")
        if name == ".DS_Store" or rel.endswith(".test.ts") or rel.startswith("node_modules/"):
            continue
        entries.append(rel)
with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for rel in sorted(entries):
        path = os.path.join(root, *rel.split("/"))
        info = zipfile.ZipInfo(rel, date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        mode = 0o755 if rel.endswith(".sh") else 0o644
        info.external_attr = (stat.S_IFREG | mode) << 16
        with open(path, "rb") as source:
            archive.writestr(info, source.read(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
`;

export async function buildPluginArchive(pluginRoot: string, outputPath: string) {
  const root = resolve(pluginRoot);
  const output = resolve(outputPath);
  const report = await inspectPlugin(root);
  if (!report.ok) throw new Error(`plugin health failed: ${report.errors.join("; ")}`);
  assertSupportedPython();
  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    const execution = Bun.spawnSync(["python3", "-c", python, root, temporary], { stdout: "pipe", stderr: "pipe" });
    if (execution.exitCode !== 0) throw new Error(`archive build failed: ${execution.stderr.toString().trim()}`);
    await rename(temporary, output);
  } finally {
    await rm(temporary, { force: true });
  }
  const digest = createHash("sha256").update(await readFile(output)).digest("hex");
  return { outputPath: output, sha256: digest, version: report.version };
}

if (import.meta.main) {
  const repositoryRoot = resolve(import.meta.dir, "..");
  const pluginRoot = resolve(process.argv[2] ?? join(repositoryRoot, "plugins", "codex-self-improvement"));
  const report = await inspectPlugin(pluginRoot);
  const output = resolve(process.argv[3] ?? join(repositoryRoot, "dist", `codex-self-improvement-${report.version}.zip`));
  const built = await buildPluginArchive(pluginRoot, output);
  process.stdout.write(`${JSON.stringify(built, null, 2)}\n`);
}
