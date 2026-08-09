import { describe, expect, test } from "bun:test";
import { AutoResearchEngine, type ExperimentCandidate, type ResearchHypothesis } from "../src/assurance/auto-research";

describe("AutoResearchEngine (autoresearch-inspired hypothesis optimization engine)", () => {
  const sampleHypothesis: ResearchHypothesis = {
    id: "hyp-001",
    statement: "Cache compiled ASTs to reduce prompt classification latency",
    baselineMetricName: "latencyMs",
    baselineValue: 120, // 120ms baseline
    optimizationDirection: "MINIMIZE",
  };

  test("initializes research experiment with hypothesis and baseline", () => {
    const engine = new AutoResearchEngine(sampleHypothesis);
    const summary = engine.getSummary();

    expect(summary.hypothesisId).toBe("hyp-001");
    expect(summary.baselineMetricName).toBe("latencyMs");
    expect(summary.baselineValue).toBe(120);
    expect(summary.totalExperiments).toBe(0);
    expect(summary.bestValue).toBe(120);
    expect(summary.winningCandidateId).toBeUndefined();
  });

  test("accepts winning candidate that improves metric over baseline", () => {
    const engine = new AutoResearchEngine(sampleHypothesis);

    const candidate1: ExperimentCandidate = {
      id: "cand-a",
      description: "In-memory LRU cache for prompt ASTs",
      measuredValue: 45, // 45ms is better than 120ms for MINIMIZE
    };

    const eval1 = engine.evaluateCandidate(candidate1);
    expect(eval1.isKept).toBe(true);
    expect(eval1.improvementPercentage).toBeGreaterThan(50);

    const summary = engine.getSummary();
    expect(summary.totalExperiments).toBe(1);
    expect(summary.bestValue).toBe(45);
    expect(summary.winningCandidateId).toBe("cand-a");
  });

  test("discards regressive candidate that performs worse than baseline", () => {
    const engine = new AutoResearchEngine(sampleHypothesis);

    const candidateRegressive: ExperimentCandidate = {
      id: "cand-bad",
      description: "Synchronous file write on every classification",
      measuredValue: 350, // 350ms is worse than 120ms for MINIMIZE
    };

    const evalResult = engine.evaluateCandidate(candidateRegressive);
    expect(evalResult.isKept).toBe(false);
    expect(evalResult.improvementPercentage).toBeLessThan(0);

    const summary = engine.getSummary();
    expect(summary.totalExperiments).toBe(1);
    expect(summary.bestValue).toBe(120); // Baseline retained
    expect(summary.winningCandidateId).toBeUndefined();
  });

  test("supports MAXIMIZE optimization direction correctly", () => {
    const throughputHypothesis: ResearchHypothesis = {
      id: "hyp-002",
      statement: "Increase batch processing throughput",
      baselineMetricName: "reqPerSec",
      baselineValue: 500,
      optimizationDirection: "MAXIMIZE",
    };

    const engine = new AutoResearchEngine(throughputHypothesis);

    const candidate = {
      id: "cand-fast",
      description: "Parallel worker pool",
      measuredValue: 1200, // 1200 req/sec > 500 req/sec
    };

    const result = engine.evaluateCandidate(candidate);
    expect(result.isKept).toBe(true);
    expect(engine.getSummary().bestValue).toBe(1200);
  });
});
