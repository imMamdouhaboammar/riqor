import { describe, expect, it } from 'bun:test';
import { WatchdogInterceptor } from '../src/watchdog-interceptor.js';

describe('watchdog-interceptor', () => {
  it('should detect repeated commands and trigger corrective prompts', () => {
    const interceptor = new WatchdogInterceptor(3);

    let res = interceptor.evaluateTurn('bun test', false, 'Syntax error');
    expect(res.triggered).toBe(false);

    res = interceptor.evaluateTurn('bun test', false, 'Syntax error');
    expect(res.triggered).toBe(false);

    res = interceptor.evaluateTurn('bun test', false, 'Syntax error');
    expect(res.triggered).toBe(true);
    expect(res.reason).toBe('repeated_command');
    expect(res.correctivePrompt).toContain('Command \'bun test\' was repeated 3 times');
  });

  it('should reset state cleanly', () => {
    const interceptor = new WatchdogInterceptor(3);
    interceptor.evaluateTurn('bun test', false);
    interceptor.evaluateTurn('bun test', false);
    interceptor.reset();
    const res = interceptor.evaluateTurn('bun test', false);
    expect(res.triggered).toBe(false);
  });
});
