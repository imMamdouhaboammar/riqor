import { describe, expect, it } from 'bun:test';
import { RulesEngine } from '../src/rules-engine.js';

describe('rules-engine', () => {
  it('should match file triggers to verification commands', () => {
    const engine = new RulesEngine([
      { id: 'ts-test', matchPattern: '*.ts', verificationCommand: 'bun test' },
      { id: 'md-lint', matchPattern: '*.md', verificationCommand: 'bun run markdownlint' }
    ]);

    const tsMatches = engine.getMatchingRules('src/index.ts');
    expect(tsMatches.length).toBe(1);
    expect(tsMatches[0].verificationCommand).toBe('bun test');

    const mdMatches = engine.getMatchingRules('README.md');
    expect(mdMatches.length).toBe(1);
    expect(mdMatches[0].verificationCommand).toBe('bun run markdownlint');
  });
});
