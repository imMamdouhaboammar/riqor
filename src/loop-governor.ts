export interface IterationRecord {
  step: number;
  passRate: number; // 0.0 - 1.0
  testFailures: number;
  churnLines: number;
  durationMs: number;
}

export type LoopStatus = "CONTINUE" | "CONVERGED" | "PLATEAUED_HALT" | "MAX_ITERATIONS_HALT";

export interface EvaluationResult {
  status: LoopStatus;
  currentStep: number;
  maxIterations: number;
  bestPassRate: number;
  recommendation: string;
}

export interface LoopGovernorOptions {
  maxIterations?: number;
  targetPassRate?: number;
  plateauThreshold?: number;
}

export class LoopGovernor {
  private maxIterations: number;
  private targetPassRate: number;
  private plateauThreshold: number;
  private history: IterationRecord[] = [];

  constructor(options?: LoopGovernorOptions) {
    this.maxIterations = options?.maxIterations ?? 10;
    this.targetPassRate = options?.targetPassRate ?? 1.0;
    this.plateauThreshold = options?.plateauThreshold ?? 3;
  }

  public getMaxIterations(): number {
    return this.maxIterations;
  }

  public getHistory(): ReadonlyArray<IterationRecord> {
    return this.history;
  }

  public recordIteration(record: IterationRecord): EvaluationResult {
    this.history.push(record);
    const bestPassRate = Math.max(...this.history.map((r) => r.passRate));

    if (record.passRate >= this.targetPassRate) {
      return {
        status: "CONVERGED",
        currentStep: record.step,
        maxIterations: this.maxIterations,
        bestPassRate,
        recommendation: "Target pass rate reached successfully.",
      };
    }

    if (this.history.length > this.plateauThreshold) {
      const recent = this.history.slice(-this.plateauThreshold);
      const firstPassRate = recent[0].passRate;
      const isStagnant = recent.every((r) => r.passRate <= firstPassRate);

      if (isStagnant) {
        return {
          status: "PLATEAUED_HALT",
          currentStep: record.step,
          maxIterations: this.maxIterations,
          bestPassRate,
          recommendation: `Progress plateau detected over the last ${this.plateauThreshold} iterations. Adjust approach or review failures.`,
        };
      }
    }

    if (record.step >= this.maxIterations) {
      return {
        status: "MAX_ITERATIONS_HALT",
        currentStep: record.step,
        maxIterations: this.maxIterations,
        bestPassRate,
        recommendation: "Maximum iterations reached without full convergence.",
      };
    }

    return {
      status: "CONTINUE",
      currentStep: record.step,
      maxIterations: this.maxIterations,
      bestPassRate,
      recommendation: "Progressing toward target. Continue next iteration.",
    };
  }
}
