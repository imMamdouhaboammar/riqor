import { describe, expect, it } from 'bun:test';
import { encodeToon, decodeToon, ActivatorContext } from '../src/toon-formatter.js';

describe('toon-formatter', () => {
  it('should encode and decode activator context efficiently', () => {
    const context: ActivatorContext = {
      task: 'Fix failing unit tests in activator',
      files: [
        { path: 'src/cli.ts', status: 'modified', additions: 15, deletions: 3 },
        { path: 'src/activator.ts', status: 'added', additions: 45, deletions: 0 }
      ],
      testSummary: {
        passed: 12,
        failed: 1,
        skipped: 0,
        total: 13,
        failures: [
          { name: 'activator > timeout', message: 'Task timed out after 3000ms' }
        ]
      }
    };

    const encoded = encodeToon(context);
    expect(encoded).toContain('@task: Fix failing unit tests in activator');
    expect(encoded).toContain('~ src/cli.ts (+15/-3)');
    expect(encoded).toContain('+ src/activator.ts (+45/-0)');
    expect(encoded).toContain('@tests: 12P/1F/0S (total:13)');
    expect(encoded).toContain('! [activator > timeout]: Task timed out after 3000ms');

    // Token savings check: TOON should be significantly shorter than JSON stringify
    const jsonLen = JSON.stringify(context, null, 2).length;
    expect(encoded.length).toBeLessThan(jsonLen * 0.7);

    const decoded = decodeToon(encoded);
    expect(decoded.task).toBe(context.task);
    expect(decoded.files.length).toBe(2);
    expect(decoded.testSummary?.passed).toBe(12);
    expect(decoded.testSummary?.failed).toBe(1);
  });
});
