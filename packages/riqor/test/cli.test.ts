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

  test("routes managed activator options through the packaged CLI", async () => {
    await expect(main(["codex", "--activator-interval", "5m"])).rejects.toThrow("require --activator");
  });
});
