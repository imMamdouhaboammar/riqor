import { describe, expect, it } from "bun:test";
import { runDeliberationGate } from "../src/deliberation-gate.js";

describe("multi-check deliberation gate", () => {
  it("runs deliberation gate and produces consensus vote", () => {
    const result = runDeliberationGate(process.cwd());
    expect(["approved", "rejected", "conditional"].includes(result.consensus)).toBe(true);
    expect(result.voteCount.total).toBe(2);
    expect(Array.isArray(result.details)).toBe(true);
  });

  it("evaluates loopy convergence loop status correctly", () => {
    const { evaluateConvergenceLoop } = require("../src/deliberation-gate.js");
    
    // Converged test
    const converged = evaluateConvergenceLoop([
      { passCount: 1, failCount: 2 },
      { passCount: 2, failCount: 1 },
      { passCount: 3, failCount: 0 },
    ]);
    expect(converged.status).toBe("converged");

    // Stalled test (circuit breaker after 3 turns with no improvement)
    const stalled = evaluateConvergenceLoop([
      { passCount: 1, failCount: 2 },
      { passCount: 1, failCount: 2 },
      { passCount: 1, failCount: 2 },
    ]);
    expect(stalled.status).toBe("stalled");

    // In progress test
    const inProgress = evaluateConvergenceLoop([
      { passCount: 1, failCount: 2 },
      { passCount: 2, failCount: 1 },
    ]);
    expect(inProgress.status).toBe("in_progress");
  });
});
