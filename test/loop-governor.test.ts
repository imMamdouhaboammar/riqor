import { expect, test, describe } from "bun:test";
import { LoopGovernor, type IterationRecord } from "../src/loop-governor.js";

describe("LoopGovernor (loop-engineering inspired convergence control)", () => {
  test("initializes with configurable options", () => {
    const governor = new LoopGovernor({ maxIterations: 5, targetPassRate: 1.0, plateauThreshold: 3 });
    expect(governor.getMaxIterations()).toBe(5);
    expect(governor.getHistory().length).toBe(0);
  });

  test("returns CONTINUE when iteration progresses towards target pass rate", () => {
    const governor = new LoopGovernor({ maxIterations: 5, targetPassRate: 1.0 });

    const step1: IterationRecord = { step: 1, passRate: 0.5, testFailures: 5, churnLines: 40, durationMs: 1200 };
    const result1 = governor.recordIteration(step1);
    expect(result1.status).toBe("CONTINUE");

    const step2: IterationRecord = { step: 2, passRate: 0.8, testFailures: 2, churnLines: 25, durationMs: 1100 };
    const result2 = governor.recordIteration(step2);
    expect(result2.status).toBe("CONTINUE");
  });

  test("returns CONVERGED when target pass rate is reached", () => {
    const governor = new LoopGovernor({ maxIterations: 5, targetPassRate: 1.0 });
    governor.recordIteration({ step: 1, passRate: 0.8, testFailures: 2, churnLines: 25, durationMs: 1100 });

    const result = governor.recordIteration({ step: 2, passRate: 1.0, testFailures: 0, churnLines: 10, durationMs: 900 });
    expect(result.status).toBe("CONVERGED");
    expect(result.recommendation).toContain("Target pass rate reached");
  });

  test("detects PLATEAUED_HALT when no pass rate improvement occurs after threshold iterations", () => {
    const governor = new LoopGovernor({ maxIterations: 10, targetPassRate: 1.0, plateauThreshold: 3 });

    governor.recordIteration({ step: 1, passRate: 0.6, testFailures: 4, churnLines: 30, durationMs: 1000 });
    governor.recordIteration({ step: 2, passRate: 0.6, testFailures: 4, churnLines: 20, durationMs: 1000 });
    governor.recordIteration({ step: 3, passRate: 0.6, testFailures: 4, churnLines: 15, durationMs: 1000 });

    const result = governor.recordIteration({ step: 4, passRate: 0.6, testFailures: 4, churnLines: 10, durationMs: 1000 });
    expect(result.status).toBe("PLATEAUED_HALT");
    expect(result.recommendation).toContain("Progress plateau detected");
  });

  test("returns MAX_ITERATIONS_HALT when max iterations reached without convergence", () => {
    const governor = new LoopGovernor({ maxIterations: 2, targetPassRate: 1.0 });

    governor.recordIteration({ step: 1, passRate: 0.5, testFailures: 5, churnLines: 50, durationMs: 1000 });
    const result = governor.recordIteration({ step: 2, passRate: 0.7, testFailures: 3, churnLines: 30, durationMs: 1000 });

    expect(result.status).toBe("MAX_ITERATIONS_HALT");
    expect(result.recommendation).toContain("Maximum iterations reached");
  });
});
