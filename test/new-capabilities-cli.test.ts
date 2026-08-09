import { describe, expect, it } from "bun:test";
import { runSkepticalVerification } from "../src/skeptical-verifier.js";
import { getSessionTelemetry } from "../src/telemetry-mcp.js";
import { calculateEnvironmentDelta } from "../src/environment-delta.js";
import { loadCrystallizedRules } from "../src/crystallized-rules.js";
import { resolve } from "node:path";

describe("riqor new capabilities CLI integrations", () => {
  it("executes skeptical verification cleanly", () => {
    const report = runSkepticalVerification(process.cwd());
    expect(["passed", "pending", "failed"].includes(report.status)).toBe(true);
    expect(typeof report.mutationsDetected).toBe("boolean");
    expect(Array.isArray(report.reasons)).toBe(true);
  });

  it("retrieves session telemetry cleanly", () => {
    const telemetry = getSessionTelemetry(process.cwd());
    expect(telemetry.repositoryRoot).toBe(resolve(process.cwd()));
  });

  it("loads and formats crystallized rules", () => {
    const rules = loadCrystallizedRules(process.cwd());
    expect(rules.length).toBeGreaterThan(0);
  });

  it("generates environment delta cleanly", () => {
    const delta = calculateEnvironmentDelta(process.cwd());
    expect(delta).toContain("[RIQOR ENVIRONMENT DELTA]");
  });
});
