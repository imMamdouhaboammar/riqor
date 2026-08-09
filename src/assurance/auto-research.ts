export type OptimizationDirection = "MINIMIZE" | "MAXIMIZE";

export type ResearchHypothesis = Readonly<{
  id: string;
  statement: string;
  baselineMetricName: string;
  baselineValue: number;
  optimizationDirection: OptimizationDirection;
}>;

export type ExperimentCandidate = Readonly<{
  id: string;
  description: string;
  measuredValue: number;
}>;

export type CandidateEvaluation = Readonly<{
  candidateId: string;
  isKept: boolean;
  baselineValue: number;
  measuredValue: number;
  improvementPercentage: number;
}>;

export type ResearchSummary = Readonly<{
  hypothesisId: string;
  statement: string;
  baselineMetricName: string;
  baselineValue: number;
  bestValue: number;
  totalExperiments: number;
  winningCandidateId?: string;
}>;

export class AutoResearchEngine {
  private readonly hypothesis: ResearchHypothesis;
  private bestValue: number;
  private winningCandidateId?: string;
  private experiments: CandidateEvaluation[] = [];

  constructor(hypothesis: ResearchHypothesis) {
    if (!hypothesis || !hypothesis.id || !hypothesis.statement || typeof hypothesis.baselineValue !== "number") {
      throw new Error("invalid research hypothesis definition");
    }
    this.hypothesis = Object.freeze({ ...hypothesis });
    this.bestValue = hypothesis.baselineValue;
  }

  public getSummary(): ResearchSummary {
    return Object.freeze({
      hypothesisId: this.hypothesis.id,
      statement: this.hypothesis.statement,
      baselineMetricName: this.hypothesis.baselineMetricName,
      baselineValue: this.hypothesis.baselineValue,
      bestValue: this.bestValue,
      totalExperiments: this.experiments.length,
      winningCandidateId: this.winningCandidateId,
    });
  }

  public evaluateCandidate(candidate: ExperimentCandidate): CandidateEvaluation {
    const isMinimize = this.hypothesis.optimizationDirection === "MINIMIZE";
    const baseline = this.hypothesis.baselineValue;

    let isKept = false;
    let improvementPercentage = 0;

    if (isMinimize) {
      improvementPercentage = ((baseline - candidate.measuredValue) / baseline) * 100;
      isKept = candidate.measuredValue < this.bestValue;
    } else {
      improvementPercentage = ((candidate.measuredValue - baseline) / baseline) * 100;
      isKept = candidate.measuredValue > this.bestValue;
    }

    if (isKept) {
      this.bestValue = candidate.measuredValue;
      this.winningCandidateId = candidate.id;
    }

    const evalResult: CandidateEvaluation = Object.freeze({
      candidateId: candidate.id,
      isKept,
      baselineValue: baseline,
      measuredValue: candidate.measuredValue,
      improvementPercentage: Number(improvementPercentage.toFixed(2)),
    });

    this.experiments.push(evalResult);
    return evalResult;
  }
}
