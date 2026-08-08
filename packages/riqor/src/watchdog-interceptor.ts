/**
 * Failproof Watchdog Interceptor
 * Inspired by FailproofAI/runtime
 * 
 * Monitors session state transitions to detect stagnation, infinite loops, and repeated
 * failing commands. Injects deterministic corrective prompts to break agent loops.
 */

export interface SessionState {
  lastCommand?: string;
  repeatCount: number;
  failingCount: number;
  lastError?: string;
}

export interface InterceptorDecision {
  triggered: boolean;
  reason?: 'repeated_command' | 'looping_failure' | 'stagnant_diff';
  correctivePrompt?: string;
}

export class WatchdogInterceptor {
  private history: SessionState[] = [];
  private readonly maxRepeatThreshold: number;

  constructor(maxRepeatThreshold: number = 3) {
    this.maxRepeatThreshold = maxRepeatThreshold;
  }

  /**
   * Evaluates the latest execution turn against history.
   */
  public evaluateTurn(command: string, success: boolean, errorMessage?: string): InterceptorDecision {
    const last = this.history[this.history.length - 1];

    let repeatCount = 1;
    let failingCount = success ? 0 : 1;

    if (last) {
      if (last.lastCommand === command) {
        repeatCount = last.repeatCount + 1;
      }
      if (!success && last.lastError === errorMessage) {
        failingCount = last.failingCount + 1;
      }
    }

    const current: SessionState = {
      lastCommand: command,
      repeatCount,
      failingCount,
      lastError: errorMessage
    };

    this.history.push(current);

    if (repeatCount >= this.maxRepeatThreshold) {
      return {
        triggered: true,
        reason: 'repeated_command',
        correctivePrompt: `[FAILPROOF WATCHDOG]: Command '${command}' was repeated ${repeatCount} times without progress. Stop repeating the exact same command. Re-examine the root cause before attempting again.`
      };
    }

    if (failingCount >= this.maxRepeatThreshold) {
      return {
        triggered: true,
        reason: 'looping_failure',
        correctivePrompt: `[FAILPROOF WATCHDOG]: The error '${errorMessage ?? 'unknown'}' occurred ${failingCount} consecutive times. Stop and re-verify assumptions instead of re-running.`
      };
    }

    return { triggered: false };
  }

  public reset(): void {
    this.history = [];
  }
}
