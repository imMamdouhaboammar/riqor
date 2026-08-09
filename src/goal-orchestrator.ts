export type SubGoal = Readonly<{
  id: string;
  description: string;
}>;

export type GoalDefinition = Readonly<{
  id: string;
  title: string;
  targetScore: number;
  maxIterations: number;
  subgoals: readonly SubGoal[];
}>;

export type GoalStepResult = Readonly<{
  score: number;
  completedSubgoalIds?: readonly string[];
  notes?: string;
}>;

export type EvaluationStatus = "CONTINUE" | "CONVERGED" | "HALTED_MAX_ITERATIONS" | "HALTED_PLATEAU";

export type GoalOrchestratorStatus = Readonly<{
  goalId: string;
  title: string;
  currentIteration: number;
  currentScore: number;
  completedSubgoals: readonly string[];
  isConverged: boolean;
  isHalted: boolean;
}>;

export class GoalLoopOrchestrator {
  private readonly goal: GoalDefinition;
  private currentIteration = 0;
  private currentScore = 0;
  private completedSubgoals: Set<string> = new Set();
  private isConverged = false;
  private isHalted = false;

  constructor(goal: GoalDefinition) {
    if (!goal || !goal.id || !goal.title || goal.targetScore <= 0 || goal.targetScore > 1.0 || goal.maxIterations <= 0) {
      throw new Error("invalid goal definition");
    }
    this.goal = Object.freeze({ ...goal });
  }

  public getStatus(): GoalOrchestratorStatus {
    return Object.freeze({
      goalId: this.goal.id,
      title: this.goal.title,
      currentIteration: this.currentIteration,
      currentScore: this.currentScore,
      completedSubgoals: Array.from(this.completedSubgoals),
      isConverged: this.isConverged,
      isHalted: this.isHalted,
    });
  }

  public evaluateIteration(step: GoalStepResult): Readonly<{
    status: EvaluationStatus;
    currentScore: number;
    completedSubgoals: readonly string[];
  }> {
    if (this.isConverged || this.isHalted) {
      const status: EvaluationStatus = this.isConverged ? "CONVERGED" : "HALTED_MAX_ITERATIONS";
      return Object.freeze({
        status,
        currentScore: this.currentScore,
        completedSubgoals: Array.from(this.completedSubgoals),
      });
    }

    this.currentIteration += 1;
    this.currentScore = Math.max(this.currentScore, Math.min(1.0, Math.max(0, step.score)));

    if (step.completedSubgoalIds) {
      for (const id of step.completedSubgoalIds) {
        this.completedSubgoals.add(id);
      }
    }

    let status: EvaluationStatus = "CONTINUE";

    if (this.currentScore >= this.goal.targetScore) {
      this.isConverged = true;
      status = "CONVERGED";
    } else if (this.currentIteration >= this.goal.maxIterations) {
      this.isHalted = true;
      status = "HALTED_MAX_ITERATIONS";
    }

    return Object.freeze({
      status,
      currentScore: this.currentScore,
      completedSubgoals: Array.from(this.completedSubgoals),
    });
  }
}
