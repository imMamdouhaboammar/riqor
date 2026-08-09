import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dir, "..");
const packageRoot = join(root, "packages", "riqor");
const roots: string[] = [];
const packageVersion = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")).version as string;

afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function run(command: string[], options: { cwd?: string; env?: Record<string, string> } = {}) {
  return Bun.spawnSync(command, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    stdout: "pipe",
    stderr: "pipe",
  });
}

async function isolatedToolPath(rootDir: string) {
  const bin = join(rootDir, "tool-bin");
  await mkdir(bin, { recursive: true });
  const tools = ["node", "bash", "python3"] as const;
  for (const tool of tools) {
    const path = Bun.which(tool);
    if (!path) throw new Error(`${tool} is required for packed CLI verification`);
    await symlink(path, join(bin, tool));
  }
  return [bin, "/usr/bin", "/bin"].join(":");
}

describe("published package end-to-end", () => {
  test("packed CLI installs, diagnoses, and uninstalls without Bun", async () => {
    const temp = await mkdtemp(join(tmpdir(), "riqor-packed-e2e-"));
    roots.push(temp);
    const artifacts = join(temp, "artifacts");
    const prefix = join(temp, "npm-prefix");
    const home = join(temp, "home");
    await mkdir(artifacts, { recursive: true });
    await mkdir(home, { recursive: true });

    const packed = run(["npm", "pack", "--json", "--pack-destination", artifacts], { cwd: packageRoot });
    expect(packed.exitCode).toBe(0);
    const packInfo = JSON.parse(packed.stdout.toString()) as Array<{ filename: string }>;
    const tarball = join(artifacts, packInfo[0].filename);

    const npmInstall = run(["npm", "install", "--prefix", prefix, "--ignore-scripts", "--no-audit", "--no-fund", tarball]);
    expect(npmInstall.exitCode).toBe(0);

    const path = await isolatedToolPath(temp);
    const env = {
      HOME: home,
      PATH: path,
      XDG_CONFIG_HOME: join(home, ".config"),
      XDG_DATA_HOME: join(home, ".local", "share"),
      XDG_STATE_HOME: join(home, ".local", "state"),
    };
    expect(run(["sh", "-c", "command -v bun"], { env }).exitCode).not.toBe(0);

    const packagedCli = join(prefix, "node_modules", ".bin", "riqor");
    const installed = run([packagedCli, "install", "--json"], { env });
    expect(installed.exitCode).toBe(0);
    const installReport = JSON.parse(installed.stdout.toString()) as { ok: boolean; checks: Array<{ id: string; ok: boolean; detail: string }> };
    expect(installReport.ok).toBe(true);
    expect(installReport.checks.find((check) => check.id === "codex-plugin")?.detail).toContain("skipped");

    const shim = join(home, ".local", "bin", "riqor");
    const version = run([shim, "version", "--json"], { env });
    expect(version.exitCode).toBe(0);
    expect(JSON.parse(version.stdout.toString()).version).toBe(packageVersion);

    const doctor = run([shim, "doctor", "--package-only", "--json"], { env });
    expect(doctor.exitCode).toBe(0);
    const doctorReport = JSON.parse(doctor.stdout.toString()) as { ok: boolean };
    expect(doctorReport.ok).toBe(true);

    const paths = run([shim, "paths", "list", "--json"], { env });
    expect(paths.exitCode).toBe(0);
    expect(JSON.parse(paths.stdout.toString()).paths.length).toBeGreaterThan(0);

    const pluginStatus = run([shim, "plugin", "status", "--json"], { env });
    expect(pluginStatus.exitCode).toBe(0);
    expect(pluginStatus.stderr.toString()).not.toContain("Bun is not defined");

    const conventions = run([shim, "conventions", "--json"], { env });
    expect(conventions.exitCode).toBe(0);
    expect(conventions.stderr.toString()).not.toContain("Bun is not defined");

    const shellInstall = run([shim, "shell", "install"], { env });
    expect(shellInstall.exitCode).toBe(0);
    expect(shellInstall.stderr.toString()).not.toContain("Bun is not defined");

    const fakeAgy = join(temp, "tool-bin", "agy");
    await writeFile(fakeAgy, "#!/bin/sh\nexit 0\n");
    await chmod(fakeAgy, 0o755);
    const agy = run([shim, "agy", "--version"], { env });
    expect(agy.exitCode).toBe(0);
    expect(agy.stderr.toString()).not.toContain("Bun is not defined");

    const removed = run([shim, "uninstall", "--json"], { env });
    expect(removed.exitCode).toBe(0);
    expect(JSON.parse(removed.stdout.toString()).ok).toBe(true);
    expect(await Bun.file(shim).exists()).toBe(false);
  }, 30000);
});
