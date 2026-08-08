import { describe, expect, it } from 'bun:test';
import { RiqorMCPServer } from '../src/mcp-server.js';

describe('mcp-server', () => {
  it('should expose Riqor evidence tools', () => {
    const server = new RiqorMCPServer();
    const tools = server.getTools();

    expect(tools.length).toBeGreaterThanOrEqual(3);
    const names = tools.map((t) => t.name);
    expect(names).toContain('riqor_get_gate_status');
    expect(names).toContain('riqor_check_evidence');
    expect(names).toContain('riqor_encode_context_toon');
  });

  it('should handle tool execution requests cleanly', () => {
    const server = new RiqorMCPServer();
    const res = server.handleToolCall('riqor_get_gate_status', {});

    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain('clear');
  });
});
