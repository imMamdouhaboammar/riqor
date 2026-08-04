import { createHash } from "node:crypto";

const requiredCategories = [
  "long_multistage",
  "unfamiliar_repo",
  "unclear_bug",
  "cross_project",
  "implicit_discovery",
  "context_recovery",
  "agent_review",
  "unsupported_completion",
] as const;

export type ScenarioCategory = (typeof requiredCategories)[number];

export type ScenarioDefinition = {
  id: string;
  category: ScenarioCategory;
  expectedTools: string[];
};

type CheckEvidence = { id: string; exitCode: number };

type ScenarioEvidence = {
  scenarioId: string;
  durationMs: number;
  agentExitCode: number;
  checks: CheckEvidence[];
  expectedTools: string[];
  observedTools: string[];
  tokens?: number;
};

export function validateScenarioSet(scenarios: ScenarioDefinition[]) {
  const categories = scenarios.map(({ category }) => category).sort();
  const expected = [...requiredCategories].sort();
  if (JSON.stringify(categories) !== JSON.stringify(expected)) {
    throw new Error("scenario set must contain all required task classes exactly once");
  }
  return scenarios;
}

export function deriveScenarioResult(evidence: ScenarioEvidence) {
  const checksPassed = evidence.checks.filter(({ exitCode }) => exitCode === 0).length;
  const qualityChecks = evidence.checks.filter(({ id }) => id !== "visible-tests");
  const qualityPassed = qualityChecks.filter(({ exitCode }) => exitCode === 0).length;
  const expected = new Set(evidence.expectedTools);
  const observed = new Set(evidence.observedTools);
  const selected = [...expected].filter((tool) => observed.has(tool)).length;
  return {
    scenarioId: evidence.scenarioId,
    passed: evidence.agentExitCode === 0 && evidence.checks.length > 0 && checksPassed === evidence.checks.length,
    checksPassed,
    checksTotal: evidence.checks.length,
    testQuality: qualityChecks.length === 0 ? 0 : qualityPassed / qualityChecks.length,
    toolSelectionAccuracy: expected.size === 0 ? 1 : selected / expected.size,
    durationMs: evidence.durationMs,
    ...(evidence.tokens === undefined ? {} : { tokens: evidence.tokens }),
  };
}

function canonicalJson(input: unknown): string {
  if (input === undefined) throw new TypeError("undefined is not supported in canonical evidence");
  if (Array.isArray(input)) return `[${input.map(canonicalJson).join(",")}]`;
  if (input !== null && typeof input === "object") {
    const entries = Object.entries(input).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  const serialized = JSON.stringify(input);
  if (serialized === undefined) throw new TypeError("undefined is not supported in canonical evidence");
  return serialized;
}

export function canonicalDigest(input: unknown) {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}
