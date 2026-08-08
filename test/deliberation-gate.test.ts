import { describe, expect, it } from "bun:test";
import { runDeliberationGate } from "../src/deliberation-gate.js";

describe("multi-check deliberation gate", () => {
  it("runs deliberation gate and produces consensus vote", () => {
    const result = runDeliberationGate(process.cwd());
    expect(["approved", "rejected", "conditional"].includes(result.consensus)).toBe(true);
    expect(result.voteCount.total).toBe(2);
    expect(Array.isArray(result.details)).toBe(true);
  });
});
