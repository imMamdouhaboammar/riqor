import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  canonicalDigest,
  deriveScenarioResult,
  validateScenarioSet,
  type ScenarioDefinition,
} from "../src/harness";
import { scenarios } from "../src/scenarios";

const requiredScenarios: ScenarioDefinition[] = [
  { id: "long-multistage", category: "long_multistage", expectedTools: ["apply_patch", "Bash"] },
  { id: "unfamiliar-repo", category: "unfamiliar_repo", expectedTools: ["apply_patch", "Bash"] },
  { id: "unclear-bug", category: "unclear_bug", expectedTools: ["apply_patch", "Bash"] },
  { id: "cross-project", category: "cross_project", expectedTools: ["apply_patch", "Bash"] },
  { id: "implicit-discovery", category: "implicit_discovery", expectedTools: ["Bash"] },
  { id: "context-recovery", category: "context_recovery", expectedTools: ["apply_patch", "Bash"] },
  { id: "agent-review", category: "agent_review", expectedTools: ["apply_patch", "Bash"] },
  { id: "unsupported-completion", category: "unsupported_completion", expectedTools: ["Bash"] },
];

describe("scenario contract", () => {
  test("accepts exactly one scenario for every required task class", () => {
    expect(validateScenarioSet(requiredScenarios)).toEqual(requiredScenarios);
  });

  test("rejects duplicate task classes", () => {
    const duplicated = requiredScenarios.with(7, { ...requiredScenarios[0], id: "duplicate" });
    expect(() => validateScenarioSet(duplicated)).toThrow("required task classes");
  });
});

describe("derived evidence", () => {
  test("derives failure from a non-zero check instead of accepting a claimed pass", () => {
    const scenarioResult = deriveScenarioResult({
      scenarioId: "unclear-bug",
      durationMs: 1200,
      agentExitCode: 0,
      checks: [
        { id: "behavior", exitCode: 0 },
        { id: "regression", exitCode: 1 },
      ],
      expectedTools: ["apply_patch", "Bash"],
      observedTools: ["apply_patch", "Bash"],
    });

    expect(scenarioResult.passed).toBe(false);
    expect(scenarioResult.checksPassed).toBe(1);
    expect(scenarioResult.checksTotal).toBe(2);
    expect(scenarioResult.testQuality).toBe(0.5);
  });

  test("scores tool selection from expected tools only", () => {
    const scenarioResult = deriveScenarioResult({
      scenarioId: "implicit-discovery",
      durationMs: 900,
      agentExitCode: 0,
      checks: [{ id: "artifact", exitCode: 0 }],
      expectedTools: ["Skill", "Bash"],
      observedTools: ["Bash", "apply_patch", "Skill"],
    });

    expect(scenarioResult.toolSelectionAccuracy).toBe(1);
    expect(scenarioResult.passed).toBe(true);
  });

  test("does not pass when the agent process fails even if checks happen to pass", () => {
    const scenarioResult = deriveScenarioResult({
      scenarioId: "agent-review",
      durationMs: 500,
      agentExitCode: 1,
      checks: [{ id: "security", exitCode: 0 }],
      expectedTools: ["shell"],
      observedTools: ["shell"],
    });
    expect(scenarioResult.passed).toBe(false);
  });
});

test("digest is stable across object key order and changes with evidence", () => {
  const first = canonicalDigest({ scenario: "review", checks: [{ id: "a", exitCode: 0 }] });
  const reordered = canonicalDigest({ checks: [{ exitCode: 0, id: "a" }], scenario: "review" });
  const changed = canonicalDigest({ scenario: "review", checks: [{ id: "a", exitCode: 1 }] });

  expect(first).toBe(reordered);
  expect(first).not.toBe(changed);
  expect(() => canonicalDigest(undefined)).toThrow("undefined");
});

test("every benchmark scenario has a bounded prompt, fixture, and derived checks", async () => {
  validateScenarioSet(scenarios);
  for (const scenario of scenarios) {
    expect(scenario.prompt.length).toBeGreaterThan(80);
    expect(scenario.checks.length).toBeGreaterThan(0);
    expect(await Bun.file(new URL(`../fixtures/${scenario.id}/TASK.md`, import.meta.url)).exists()).toBe(true);
    expect(await Bun.file(new URL(`../graders/${scenario.id}.ts`, import.meta.url)).exists()).toBe(true);
  }
});

test("read-only completion grader pins every original repository file", async () => {
  const grader = await Bun.file(new URL("../graders/unsupported-completion.ts", import.meta.url)).text();
  for (const path of ["TASK.md", "COMPLETION.md", "package.json", "src/export.ts"]) {
    const contents = await Bun.file(new URL(`../fixtures/unsupported-completion/${path}`, import.meta.url)).text();
    const digest = createHash("sha256").update(contents).digest("hex");
    expect(grader).toContain(digest);
  }
});
