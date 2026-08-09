import { describe, expect, test } from "bun:test";
import { GoalLoopOrchestrator, type GoalDefinition, type GoalStepResult } from "../src/goal-orchestrator";

describe("GoalLoopOrchestrator (loopy-inspired goal-driven loop harness)", () => {
  test("initializes with a valid target goal definition", () => {
    const goal: GoalDefinition = {
      id: "goal-101",
      title: "Optimize Test Suite Execution",
      targetScore: 0.95,
      maxIterations: 5,
      subgoals: [
        { id: "sub-1", description: "Identify slow tests" },
        { id: "sub-2", description: "Parallelize test runners" },
      ],
    };

    const orchestrator = new GoalLoopOrchestrator(goal);
    const status = orchestrator.getStatus();

    expect(status.goalId).toBe("goal-101");
    expect(status.title).toBe("Optimize Test Suite Execution");
    expect(status.currentIteration).toBe(0);
    expect(status.currentScore).toBe(0);
    expect(status.completedSubgoals).toEqual([]);
    expect(status.isConverged).toBe(false);
    expect(status.isHalted).toBe(false);
  });

  test("evaluates iteration progress and updates milestone completions", () => {
    const goal: GoalDefinition = {
      id: "goal-102",
      title: "Refactor Security Modules",
      targetScore: 0.9,
      maxIterations: 3,
      subgoals: [
        { id: "sub-auth", description: "Audit Auth Token handling" },
        { id: "sub-sanitization", description: "Sanitize SQL inputs" },
      ],
    };

    const orchestrator = new GoalLoopOrchestrator(goal);

    const step1: GoalStepResult = {
      score: 0.5,
      completedSubgoalIds: ["sub-auth"],
      notes: "Auth token handling audited",
    };

    const result1 = orchestrator.evaluateIteration(step1);
    expect(result1.status).toBe("CONTINUE");
    expect(result1.currentScore).toBe(0.5);
    expect(result1.completedSubgoals).toContain("sub-auth");

    const step2: GoalStepResult = {
      score: 0.95,
      completedSubgoalIds: ["sub-sanitization"],
      notes: "SQL inputs sanitized",
    };

    const result2 = orchestrator.evaluateIteration(step2);
    expect(result2.status).toBe("CONVERGED");
    expect(result2.currentScore).toBe(0.95);
    expect(orchestrator.getStatus().isConverged).toBe(true);
  });

  test("halts when max iterations are exceeded without convergence", () => {
    const goal: GoalDefinition = {
      id: "goal-103",
      title: "Hard Goal",
      targetScore: 0.99,
      maxIterations: 2,
      subgoals: [],
    };

    const orchestrator = new GoalLoopOrchestrator(goal);

    orchestrator.evaluateIteration({ score: 0.2 });
    const result2 = orchestrator.evaluateIteration({ score: 0.3 });

    expect(result2.status).toBe("HALTED_MAX_ITERATIONS");
    expect(orchestrator.getStatus().isHalted).toBe(true);
  });

  test("rejects invalid goal definitions cleanly", () => {
    expect(() => new GoalLoopOrchestrator({ id: "", title: "", targetScore: -1, maxIterations: 0, subgoals: [] }))
      .toThrow("invalid goal definition");
  });
});
