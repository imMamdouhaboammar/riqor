/**
 * Declarative Workflow Rules Engine
 * Inspired by Budibase/budibase
 * 
 * Evaluates custom verification rules (e.g. file pattern triggers to test scripts)
 * to enforce project-specific evidence gates.
 */

export interface RuleDefinition {
  id: string;
  matchPattern: string; // e.g. "src/**/*.ts"
  verificationCommand: string; // e.g. "bun test"
}

export class RulesEngine {
  private rules: RuleDefinition[] = [];

  constructor(initialRules: RuleDefinition[] = []) {
    this.rules = initialRules;
  }

  public addRule(rule: RuleDefinition): void {
    this.rules.push(rule);
  }

  public getMatchingRules(filePath: string): RuleDefinition[] {
    return this.rules.filter((rule) => {
      if (rule.matchPattern === '*' || rule.matchPattern === '**/*') return true;
      const extensionMatch = rule.matchPattern.match(/\.([a-z0-9]+)$/i);
      if (extensionMatch) {
        return filePath.endsWith(`.${extensionMatch[1]}`);
      }
      return filePath.includes(rule.matchPattern.replace(/[\*\.]/g, ''));
    });
  }
}
