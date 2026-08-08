/**
 * Autonomous Self-Verification Loop Engine ("Ralph Loop")
 * Inspired by zomars/ralph
 * 
 * Automates continuous trial-and-error verification iterations.
 * Executes test verification commands, inspects outputs, and automatically
 * prepares feedback prompts until all evidence gates pass or max iterations are reached.
 */

export interface LoopOptions {
  maxIterations: number;
  testCommand: string;
  onIteration?: (iteration: number, status: 'pass' | 'fail', output: string) => void;
}

export interface LoopResult {
  success: boolean;
  iterations: number;
  finalOutput: string;
  history: Array<{ iteration: number; status: 'pass' | 'fail'; output: string }>;
}

export class AutoVerifyLoop {
  private readonly options: LoopOptions;

  constructor(options: Partial<LoopOptions> = {}) {
    this.options = {
      maxIterations: options.maxIterations ?? 5,
      testCommand: options.testCommand ?? 'bun test',
      onIteration: options.onIteration
    };
  }

  /**
   * Simulates/runs one verification cycle and builds the Ralph feedback prompt if failed.
   */
  public generateFeedbackPrompt(iteration: number, testOutput: string): string {
    return [
      `[RALPH AUTO-VERIFY LOOP - Iteration ${iteration}/${this.options.maxIterations}]`,
      `Verification command '${this.options.testCommand}' failed with the following evidence:`,
      `---`,
      testOutput.trim(),
      `---`,
      `Instructions: Modify the code to fix the root cause. Do NOT claim completion until this exact verification command passes.`
    ].join('\n');
  }
}
