import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { main } from "../src/cli";
import { doctor } from "../src/commands/doctor";
import { status } from "../src/commands/status";

const packageRoot = resolve(import.meta.dir, "..");

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
    expect(report.version).toBe("0.1.1");
    expect(report.surfaces).toBeObject();
  });

  test("doctor --package-only checks package payload without requiring codex", async () => {
    const report = await withPackageRoot(() => doctor({ packageOnly: true }));
    expect(report.ok).toBe(true);
    expect(report.checks).toBeArray();
    expect(report.checks.some((c) => c.id === "package-version")).toBe(true);
    expect(report.checks.some((c) => c.id === "payload-provenance")).toBe(true);
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
