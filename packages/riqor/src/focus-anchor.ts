/**
 * Focus Anchor & Anti-Drift Engine
 * Inspired by ayghri/i-have-adhd
 * 
 * Sets cognitive focus boundaries and micro-goal anchors during AI activator checkpoints,
 * preventing scope creep and unrequested refactoring.
 */

export interface FocusAnchorGoal {
  id: string;
  title: string;
  completed: boolean;
  verificationEvidence?: string;
}

export class FocusAnchorEngine {
  private currentAnchor?: FocusAnchorGoal;

  public setAnchor(title: string): FocusAnchorGoal {
    this.currentAnchor = {
      id: `anchor-${Date.now()}`,
      title,
      completed: false
    };
    return this.currentAnchor;
  }

  public getAnchor(): FocusAnchorGoal | undefined {
    return this.currentAnchor;
  }

  public completeAnchor(evidence: string): void {
    if (this.currentAnchor) {
      this.currentAnchor.completed = true;
      this.currentAnchor.verificationEvidence = evidence;
    }
  }

  public formatFocusPrompt(): string {
    if (!this.currentAnchor || this.currentAnchor.completed) {
      return '[FOCUS ANCHOR]: No active micro-goal anchor.';
    }
    return [
      `[FOCUS ANCHOR - ACTIVE MICRO-GOAL]`,
      `Current Focus: ${this.currentAnchor.title}`,
      `Rule: Complete and verify ONLY this goal before touching unrelated code or initiating scope expansion.`
    ].join('\n');
  }
}
