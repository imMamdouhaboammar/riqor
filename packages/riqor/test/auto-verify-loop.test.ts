import { describe, expect, it } from 'bun:test';
import { AutoVerifyLoop } from '../src/auto-verify-loop.js';

describe('auto-verify-loop', () => {
  it('should generate Ralph feedback prompt for failed verification runs', () => {
    const loop = new AutoVerifyLoop({ maxIterations: 5, testCommand: 'bun test' });
    const prompt = loop.generateFeedbackPrompt(1, '1 test failed: timeout');

    expect(prompt).toContain('[RALPH AUTO-VERIFY LOOP - Iteration 1/5]');
    expect(prompt).toContain("Verification command 'bun test' failed");
    expect(prompt).toContain('1 test failed: timeout');
  });
});
