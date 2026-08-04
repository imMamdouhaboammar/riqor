import { expect, test } from "bun:test";
import {
  buildCodexCommand,
  countErrorLines,
  completionExitCode,
  compareBenchmarks,
  extractTelemetry,
  renderBaseline,
  renderFinalEvaluation,
  resolveCheckCommand,
  summarizeBenchmark,
} from "../src/runner";

test("extracts bounded tool, message, and usage telemetry from Codex JSONL", () => {
  const events = [
    { type: "thread.started", thread_id: "private-thread" },
    { type: "item.completed", item: { type: "command_execution", command: "bun test", exit_code: 0 } },
    { type: "item.completed", item: { type: "file_change", changes: [{ path: "/private/repo/src/a.ts" }] } },
    { type: "item.completed", item: { type: "agent_message", text: "done" } },
    { type: "turn.completed", usage: { input_tokens: 100, cached_input_tokens: 20, output_tokens: 8 } },
  ].map((event) => JSON.stringify(event)).join("\n");

  expect(extractTelemetry(events)).toEqual({
    observedTools: ["shell", "apply_patch"],
    finalMessage: "done",
    inputTokens: 100,
    cachedInputTokens: 20,
    outputTokens: 8,
    usageAvailable: true,
    eventErrors: 0,
  });
});

test("recognizes a relevant implicit skill without exposing the event", () => {
  const event = JSON.stringify({ type: "item.completed", item: { type: "command_execution", command: "sed -n 1,80p /skills/postgresql-table-design/SKILL.md" } });
  expect(extractTelemetry(event).observedTools).toEqual(["shell", "skill:postgresql-table-design"]);
  const reviewEvent = JSON.stringify({ type: "item.completed", item: { type: "command_execution", command: "sed -n 1,80p /skills/verification-before-completion/SKILL.md" } });
  expect(extractTelemetry(reviewEvent).observedTools).toEqual(["shell", "skill:verification-before-completion"]);
  const mentionOnly = JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "I did not read /skills/verification-before-completion/SKILL.md" } });
  expect(extractTelemetry(mentionOnly).observedTools).toEqual([]);
  const echoedPath = JSON.stringify({ type: "item.completed", item: { type: "command_execution", command: "echo /skills/verification-before-completion/SKILL.md", exit_code: 0 } });
  expect(extractTelemetry(echoedPath).observedTools).toEqual(["shell"]);
  const echoedReader = JSON.stringify({ type: "item.completed", item: { type: "command_execution", command: "echo cat /skills/verification-before-completion/SKILL.md", exit_code: 0 } });
  expect(extractTelemetry(echoedReader).observedTools).toEqual(["shell"]);
  const bunRead = JSON.stringify({ type: "item.completed", item: { type: "command_execution", command: "bun -e \"await Bun.file('/skills/verification-before-completion/SKILL.md').text()\"", exit_code: 0 } });
  expect(extractTelemetry(bunRead).observedTools).toEqual(["shell", "skill:verification-before-completion"]);
  const commentOnly = JSON.stringify({ type: "item.completed", item: { type: "command_execution", command: "cat /dev/null # /skills/verification-before-completion/SKILL.md", exit_code: 0 } });
  expect(extractTelemetry(commentOnly).observedTools).toEqual(["shell"]);
  const hereString = JSON.stringify({ type: "item.completed", item: { type: "command_execution", command: "cat <<< '/skills/verification-before-completion/SKILL.md'", exit_code: 0 } });
  expect(extractTelemetry(hereString).observedTools).toEqual(["shell"]);
  const wrappedRead = JSON.stringify({ type: "item.completed", item: { type: "command_execution", command: "sh -c 'cat /skills/verification-before-completion/SKILL.md'", exit_code: 0 } });
  expect(extractTelemetry(wrappedRead).observedTools).toEqual(["shell", "skill:verification-before-completion"]);
});

test("resolves grader paths against the harness root", () => {
  expect(resolveCheckCommand(["bun", "../../graders/a.ts", "."], "/harness")).toEqual([
    "bun",
    "/harness/graders/a.ts",
    ".",
  ]);
  expect(resolveCheckCommand(["bun", "../../holdouts/graders/b.ts", "."], "/harness")).toEqual([
    "bun",
    "/harness/holdouts/graders/b.ts",
    ".",
  ]);
  expect(resolveCheckCommand(["{{BUN}}"], "/harness")[0]).toMatch(/\/bun$/);
});

test("pins reproducible non-interactive Codex execution flags", () => {
  const command = buildCodexCommand("/repo", "/repo/final.txt", "task");
  expect(command.slice(0, 6)).toEqual([
    "codex", "exec", "--json", "--ephemeral", "--skip-git-repo-check", "--dangerously-bypass-hook-trust",
  ]);
  expect(command).toContain('default_permissions="benchmark-isolated"');
  expect(command).toContain('approval_policy="never"');
  expect(command).toContain('web_search="disabled"');
  expect(command.join(" ")).toContain('\":root\"=\"deny\"');
  expect(command).not.toContain("workspace-write");
  expect(command.slice(-7)).toEqual(["-m", "gpt-5.6-sol", "-C", "/repo", "-o", "/repo/final.txt", "task"]);
});

test("records a killed timeout as failure and does not invent usage", () => {
  expect(completionExitCode(0, true)).toBe(124);
  expect(extractTelemetry(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "partial" } })).usageAvailable).toBe(false);
  expect(extractTelemetry(JSON.stringify({ type: "error", message: "boom" })).eventErrors).toBe(1);
  expect(extractTelemetry(JSON.stringify({ type: "turn.completed", usage: {} })).usageAvailable).toBe(false);
  expect(extractTelemetry(JSON.stringify({ type: "turn.completed", usage: { input_tokens: -1, output_tokens: 1 } })).usageAvailable).toBe(false);
  const malformed = `not-json\n${JSON.stringify({ type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } })}`;
  expect(extractTelemetry(malformed).eventErrors).toBe(1);
  expect(extractTelemetry(JSON.stringify({ type: "item.completed", item: { type: "command_execution", command: "false", exit_code: 1 } })).eventErrors).toBe(1);
  expect(countErrorLines("ERROR one\nerror: two\n2026-08-04 ERROR module failed\ncompleted without error")).toBe(3);
  expect(countErrorLines("No error occurred\ncompleted without error \nnot an error: warning")).toBe(0);
});

test("summarizes benchmark evidence without prompts, paths, or raw output", () => {
  const summary = summarizeBenchmark([
    { scenarioId: "a", passed: true, checksPassed: 2, checksTotal: 2, testQuality: 1, toolSelectionAccuracy: 1, durationMs: 100, tokens: 20, interventionRequired: false, eventErrors: 0 },
    { scenarioId: "b", passed: false, checksPassed: 1, checksTotal: 2, testQuality: 0, toolSelectionAccuracy: 0.5, durationMs: 300, tokens: 30, interventionRequired: true, eventErrors: 2 },
  ]);

  expect(summary).toEqual({
    scenariosPassed: 1,
    scenariosTotal: 2,
    correctCompletionRate: 0.5,
    checksPassed: 3,
    checksTotal: 4,
    heldOutCheckRate: 0.75,
    testQuality: 0.5,
    toolSelectionAccuracy: 0.75,
    humanInterventions: 1,
    durationMs: 400,
    tokens: 50,
    tokenScenarios: 2,
    eventErrors: 2,
  });
  expect(JSON.stringify(summary)).not.toMatch(/prompt|private|raw/i);
});

test("token comparison uses a conservative control lower bound and all candidate usage", () => {
  const control = [
    { scenarioId: "timed-out", passed: false, checksPassed: 0, checksTotal: 1, testQuality: 0, toolSelectionAccuracy: 1, durationMs: 600, tokens: null, interventionRequired: true, eventErrors: 1 },
    { scenarioId: "measured", passed: true, checksPassed: 1, checksTotal: 1, testQuality: 1, toolSelectionAccuracy: 1, durationMs: 200, tokens: 100, interventionRequired: false, eventErrors: 1 },
  ];
  const candidate = [
    { scenarioId: "timed-out", passed: true, checksPassed: 1, checksTotal: 1, testQuality: 1, toolSelectionAccuracy: 1, durationMs: 100, tokens: 80, interventionRequired: false, eventErrors: 0 },
    { scenarioId: "measured", passed: true, checksPassed: 1, checksTotal: 1, testQuality: 1, toolSelectionAccuracy: 1, durationMs: 100, tokens: 50, interventionRequired: false, eventErrors: 0 },
  ];
  expect(compareBenchmarks(control, candidate, true).tokenReduction).toBe(-0.3);
  expect(compareBenchmarks(control, candidate, true).accepted).toBe(false);
  expect(renderFinalEvaluation({
    runId: "compare-matched",
    startedAt: "2026-08-04",
    control,
    candidate,
    rollbackVerified: true,
  })).toContain("control lower bound");
});

test("rejects missing, duplicated, or mismatched candidate scenarios", () => {
  const result = (scenarioId: string, candidate = false) => ({
    scenarioId,
    passed: true,
    checksPassed: 1,
    checksTotal: 1,
    testQuality: 1,
    toolSelectionAccuracy: 1,
    durationMs: candidate ? 50 : 100,
    tokens: candidate ? 5 : 10,
    interventionRequired: false,
    eventErrors: candidate ? 0 : 1,
  });
  expect(compareBenchmarks([result("a"), result("b")], [result("a", true)], true).accepted).toBe(false);
  expect(compareBenchmarks([result("a")], [result("a", true), result("a", true)], true).accepted).toBe(false);
  expect(compareBenchmarks([result("a")], [{ ...result("a", true), tokens: null }], true).accepted).toBe(false);
  expect(compareBenchmarks([result("a")], [{ ...result("a", true), tokens: -100 }], true).accepted).toBe(false);
  expect(() => renderFinalEvaluation({
    runId: "mismatch",
    startedAt: "2026-08-04",
    control: [result("a"), result("b")],
    candidate: [result("a", true)],
    rollbackVerified: true,
  })).not.toThrow();
});

test("renders an evidence-scoped baseline report", () => {
  const report = renderBaseline({
    runId: "baseline-001",
    objectiveDigest: "objective-sha",
    configDigest: "config-sha",
    pluginDigest: "plugin-sha",
    codexVersion: "codex-cli test",
    model: "test-model",
    startedAt: "2026-08-04T00:00:00.000Z",
    results: [
      { scenarioId: "a", passed: true, checksPassed: 2, checksTotal: 2, testQuality: 1, toolSelectionAccuracy: 1, durationMs: 100, tokens: 20, interventionRequired: false, eventErrors: 0 },
    ],
  });
  expect(report).toContain("# Baseline Evaluation");
  expect(report).toContain("1 / 1");
  expect(report).toContain("config-sha");
  expect(report).not.toMatch(/prompt|raw output|private-thread/i);
});

test("accepts a candidate only when correctness and rollback hold while cost improves", () => {
  const control = [
    { scenarioId: "holdout", passed: true, checksPassed: 1, checksTotal: 1, testQuality: 1, toolSelectionAccuracy: 1, durationMs: 200, tokens: 100, interventionRequired: false, eventErrors: 4 },
  ];
  const candidate = [
    { scenarioId: "holdout", passed: true, checksPassed: 1, checksTotal: 1, testQuality: 1, toolSelectionAccuracy: 1, durationMs: 100, tokens: 50, interventionRequired: false, eventErrors: 2 },
  ];
  const comparison = compareBenchmarks(control, candidate, true);
  expect(comparison.accepted).toBe(true);
  expect(comparison.timeReduction).toBe(0.5);
  expect(comparison.tokenReduction).toBe(0.5);
  expect(comparison.errorReduction).toBe(0.5);
  expect(renderFinalEvaluation({ runId: "compare-1", startedAt: "2026-08-04", control, candidate, rollbackVerified: true })).toContain("ACCEPTED");
});

test("rejects an efficient candidate with a correctness regression", () => {
  const control = [
    { scenarioId: "holdout", passed: true, checksPassed: 1, checksTotal: 1, testQuality: 1, toolSelectionAccuracy: 1, durationMs: 200, tokens: 100, interventionRequired: false, eventErrors: 4 },
  ];
  const candidate = [{ ...control[0], passed: false, durationMs: 50, tokens: 10 }];
  expect(compareBenchmarks(control, candidate, true).accepted).toBe(false);
});
