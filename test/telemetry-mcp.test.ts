import { describe, expect, it } from "bun:test";
import { getSessionTelemetry, handleMcpRequest } from "../src/telemetry-mcp.js";

describe("telemetry and mcp engine", () => {
  it("generates session telemetry structure", () => {
    const telemetry = getSessionTelemetry(process.cwd());
    expect(telemetry).toHaveProperty("repositoryRoot");
    expect(telemetry).toHaveProperty("activeBranch");
    expect(telemetry).toHaveProperty("latestCommitHash");
    expect(telemetry).toHaveProperty("verification");
    expect(telemetry).toHaveProperty("metrics");
    expect(typeof telemetry.metrics.uncommittedFilesCount).toBe("number");
  });

  it("handles MCP tools/list method", () => {
    const response = handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(response).toHaveProperty("result");
    const res = response as { result: { tools: Array<{ name: string }> } };
    expect(res.result.tools.length).toBeGreaterThan(0);
    expect(res.result.tools[0].name).toBe("riqor_get_session_telemetry");
  });

  it("handles MCP tools/call method for riqor_get_session_telemetry", () => {
    const response = handleMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "riqor_get_session_telemetry" },
    });
    expect(response).toHaveProperty("result");
    const res = response as { result: { content: Array<{ type: string; text: string }> } };
    expect(res.result.content[0].type).toBe("text");
    const telemetryObj = JSON.parse(res.result.content[0].text);
    expect(telemetryObj).toHaveProperty("activeBranch");
  });
});
