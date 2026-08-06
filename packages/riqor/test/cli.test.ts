import { describe, expect, test } from "bun:test";
import { main } from "../src/cli";
import { doctor } from "../src/commands/doctor";
import { status } from "../src/commands/status";

describe("packages/riqor CLI", () => {
  test("status reports package version and plugin version", async () => {
    const report = await status({});
    expect(report.version).toBe("0.1.0");
    expect(report.surfaces).toBeObject();
  });

  test("doctor --package-only checks package payload without requiring codex", async () => {
    const report = await doctor({ packageOnly: true });
    expect(report.checks).toBeArray();
    expect(report.checks.some((c) => c.id === "package-version")).toBe(true);
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
      process.exitCode = previousExitCode;
    }
  });
});
