import { describe, expect, it } from 'bun:test';
import { FocusAnchorEngine } from '../src/focus-anchor.js';

describe('focus-anchor', () => {
  it('should set and enforce micro-goal focus anchors', () => {
    const engine = new FocusAnchorEngine();
    engine.setAnchor('Fix TOON decoder regex boundary');

    const prompt = engine.formatFocusPrompt();
    expect(prompt).toContain('[FOCUS ANCHOR - ACTIVE MICRO-GOAL]');
    expect(prompt).toContain('Fix TOON decoder regex boundary');

    engine.completeAnchor('Passed unit test in toon-formatter.test.ts');
    expect(engine.getAnchor()?.completed).toBe(true);
  });
});
