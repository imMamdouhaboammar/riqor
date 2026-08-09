import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Declarative Workflow DAG Schema (Dify-inspired)", () => {
  const schemaPath = join(process.cwd(), "schemas", "workflow-dag.json");

  test("workflow-dag.json schema file exists and is valid JSON", () => {
    const raw = readFileSync(schemaPath, "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(parsed.title).toBe("RiqorWorkflowDAG");
    expect(parsed.properties.nodes).toBeDefined();
    expect(parsed.properties.edges).toBeDefined();
  });

  test("validates sample workflow DAG structure", () => {
    const sampleDAG = {
      version: "1.0.0",
      name: "TDD Security Review Workflow",
      nodes: [
        { id: "start_1", type: "start", title: "User Prompt Ingest" },
        { id: "spec_2", type: "llm", title: "Generate Spec", config: { prompt: "Write PRD" } },
        { id: "scan_3", type: "tool", title: "AgentShield Security Scan", config: { tool: "security-scan" } },
        { id: "end_4", type: "end", title: "Complete Execution" },
      ],
      edges: [
        { source: "start_1", target: "spec_2" },
        { source: "spec_2", target: "scan_3" },
        { source: "scan_3", target: "end_4" },
      ],
    };

    expect(sampleDAG.version).toBe("1.0.0");
    expect(sampleDAG.nodes.length).toBe(4);
    expect(sampleDAG.edges.length).toBe(3);
  });
});
