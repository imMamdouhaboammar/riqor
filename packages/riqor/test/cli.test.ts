import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { recordAdoptionEvent } from "../src/adoption";
import { main } from "../src/cli";
import { doctor } from "../src/commands/doctor";
import { status } from "../src/commands/status";

const packageRoot = resolve(import.meta.dir, "..");
const packageVersion = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")).version as string;

async function withPackageRoot<T>(run: () => Promise<T>) {
  const previousPackageRoot = process.env.RIQOR_PACKAGE_ROOT;
  const previousRuntimeRoot = process.env.RIQOR_RUNTIME_ROOT;
  process.env.RIQOR_PACKAGE_ROOT = packageRoot;
  process.env.RIQOR_RUNTIME_ROOT = join(packageRoot, "runtime");
  try {
    return await run();
  } finally {
    if (previousPackageRoot === undefined) delete process.env.RIQOR_PACKAGE_ROOT;
    else process.env.RIQOR_PACKAGE_ROOT = previousPackageRoot;
    if (previousRuntimeRoot === undefined) delete process.env.RIQOR_RUNTIME_ROOT;
    else process.env.RIQOR_RUNTIME_ROOT = previousRuntimeRoot;
  }
}

describe("packages/riqor CLI", () => {
  test("status reports package version and plugin version", async () => {
    const report = await withPackageRoot(() => status({}));
    expect(report.version).toBe(packageVersion);
    expect(report.surfaces).toBeObject();
  });

  test("doctor --package-only checks package payload without requiring codex", async () => {
    const report = await withPackageRoot(() => doctor({ packageOnly: true }));
    expect(report.ok).toBe(true);
    expect(report.checks).toBeArray();
    expect(report.checks.some((c) => c.id === "package-version")).toBe(true);
    expect(report.checks.some((c) => c.id === "payload-provenance")).toBe(true);
  });

  test("adoption --json reports the local ledger without claiming Marketplace installs", async () => {
    const root = await mkdtemp(join(tmpdir(), "riqor-cli-adoption-"));
    const previousState = process.env.XDG_STATE_HOME;
    const previousExitCode = process.exitCode;
    const originalStdout = process.stdout.write;
    const originalStderr = process.stderr.write;
    let stdout = "";
    process.env.XDG_STATE_HOME = root;
    process.exitCode = undefined;
    await recordAdoptionEvent({ stateDir: join(root, "riqor"), version: "0.2.4", kind: "session", now: Date.parse("2026-08-09T10:00:00Z") });
    process.stdout.write = ((chunk: string | Uint8Array) => { stdout += String(chunk); return true; }) as typeof process.stdout.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;
    try {
      await main(["adoption", "--json"]);
      expect(process.exitCode).not.toBe(64);
      const report = JSON.parse(stdout);
      expect(report.marketplaceInstalls).toBe("unknown");
      expect(report.sessions).toBe(1);
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
      process.exitCode = previousExitCode ?? 0;
      if (previousState === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = previousState;
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects invalid activator options before launching Codex", async () => {
    const previousExitCode = process.exitCode;
    const originalWrite = process.stderr.write;
    let stderr = "";
    process.exitCode = undefined;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderr += String(chunk);
      return true;
    }) as typeof process.stderr.write;

    try {
      await main(["codex", "--activator-interval", "5m"]);
      expect(process.exitCode).toBe(64);
      expect(stderr).toContain("require --activator");
      expect(stderr).not.toContain("at ");
    } finally {
      process.stderr.write = originalWrite;
      process.exitCode = previousExitCode ?? 0;
    }
  });
});
