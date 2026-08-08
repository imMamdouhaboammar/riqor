import { describe, expect, it } from "bun:test";
import { calculateEnvironmentDelta } from "../src/environment-delta.js";

describe("environment delta generator", () => {
  it("calculates high-density environment delta prompt block", () => {
    const delta = calculateEnvironmentDelta(process.cwd());
    expect(delta).toContain("[RIQOR ENVIRONMENT DELTA]");
    expect(delta).toContain("• Active Branch:");
    expect(delta).toContain("• Skeptical Verification:");
  });
});
