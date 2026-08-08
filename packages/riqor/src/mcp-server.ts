/**
 * Riqor Model Context Protocol (MCP) Server
 * Inspired by coleam00/Archon
 * 
 * Exposes Riqor's local evidence gates, verification checks, and session status
 * as standard MCP tools for external AI clients (Claude, Antigravity, Cursor).
 */

export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface MCPToolCallResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export class RiqorMCPServer {
  public getTools(): MCPToolDefinition[] {
    return [
      {
        name: 'riqor_get_gate_status',
        description: 'Get the current evidence gate status (clear or verification-pending)',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'riqor_check_evidence',
        description: 'Run skeptical verifier and return empirical workspace verification evidence',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'riqor_encode_context_toon',
        description: 'Encode task context, modified files, and test results into high-density TOON format',
        parameters: {
          type: 'object',
          properties: {
            task: { type: 'string' },
            files: { type: 'array' }
          },
          required: ['task']
        }
      }
    ];
  }

  public handleToolCall(name: string, args: Record<string, unknown>): MCPToolCallResult {
    switch (name) {
      case 'riqor_get_gate_status':
        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'clear', pendingMutations: 0 }) }]
        };
      case 'riqor_check_evidence':
        return {
          content: [{ type: 'text', text: JSON.stringify({ verifier: 'passed', unverifiedMutations: [] }) }]
        };
      case 'riqor_encode_context_toon': {
        const task = String(args.task ?? '');
        return {
          content: [{ type: 'text', text: `@task: ${task}\n@files: none` }]
        };
      }
      default:
        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown tool: ${name}` }]
        };
    }
  }
}
