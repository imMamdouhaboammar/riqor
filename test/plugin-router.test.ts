import { describe, expect, test } from "bun:test";
import { classifyPrompt, routingContext } from "../plugins/riqor/hooks/router";

describe("task router", () => {
  const cases = [
    ["Repair the PostgreSQL RLS schema and add the pending delivery index", "database"],
    ["Trace this intermittent cache bug to its root cause", "debugging"],
    ["Review the completion claim and verify every test result", "review"],
    ["Audit the authorization boundary for prompt injection", "security"],
    ["Fix the RTL layout and accessibility issues in this React page", "ui"],
    ["Find the current official API documentation before changing this integration", "research"],
    ["Map PII retention and DSAR deletion coverage", "privacy"],
    ["Benchmark API latency and throughput under a fixed local load", "performance"],
    ["Create a measured self-evolve playbook from this repeated failure", "evolution"],
    ["Add a batch import feature across the API and CLI", "engineering"],
  ] as const;

  for (const [prompt, expected] of cases) {
    test(`classifies ${expected}`, () => {
      expect(classifyPrompt(prompt).profile).toBe(expected);
    });
  }

  test("prefers a specific domain over generic audit wording", () => {
    expect(classifyPrompt("Audit this PostgreSQL tenant schema").profile).toBe("database");
    expect(classifyPrompt("Audit this OAuth authorization flow").profile).toBe("security");
  });

  test("does not route generic current-state wording to research", () => {
    expect(classifyPrompt("Implement current user state handling").profile).toBe("engineering");
    expect(classifyPrompt("Find current API documentation").profile).toBe("research");
  });

  test("returns bounded context without echoing the user prompt", () => {
    const prompt = "CUSTOMER_XYZZY trace the broken cache flow";
    const context = routingContext(prompt);
    expect(context).toContain("Profile: debugging");
    expect(context).toContain("Harness path: evidence-loop");
    expect(context).toContain("systematic-debugging");
    expect(context).not.toContain("CUSTOMER_XYZZY");
    expect(context.length).toBeLessThanOrEqual(900);
  });

  test("returns immutable routing data", () => {
    const first = classifyPrompt("fix this bug");
    expect(() => first.skills.push("invented-skill")).toThrow();
    expect(() => first.path.guardrails.push("invented guardrail")).toThrow();
  });
});
