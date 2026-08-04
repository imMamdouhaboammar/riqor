import { resolve } from "node:path";
import { homedir } from "node:os";
import { realpathSync } from "node:fs";

type CodexEvent = {
  type?: string;
  item?: { type?: string; text?: string; command?: string; exit_code?: number };
  usage?: { input_tokens?: number; cached_input_tokens?: number; output_tokens?: number };
};

export type PublicScenarioResult = {
  scenarioId: string;
  passed: boolean;
  checksPassed: number;
  checksTotal: number;
  testQuality: number;
  toolSelectionAccuracy: number;
  durationMs: number;
  tokens: number | null;
  interventionRequired: boolean;
  eventErrors: number;
  checkEvidence?: Array<{ id: string; exitCode: number }>;
  agentExitCode?: number;
  finalOutputDigest?: string | null;
  harnessPath?: string | null;
};

export type BenchmarkRun = {
  runId: string;
  objectiveDigest: string;
  configDigest: string;
  pluginDigest: string;
  codexVersion: string;
  model: string;
  startedAt: string;
  results: PublicScenarioResult[];
};

export type FinalEvaluation = {
  runId: string;
  startedAt: string;
  control: PublicScenarioResult[];
  candidate: PublicScenarioResult[];
  rollbackVerified: boolean;
  wholeRunStateUnchanged?: boolean;
};

export function buildCodexCommand(repo: string, finalPath: string, prompt: string) {
  const agentSkills = JSON.stringify(resolve(homedir(), ".agents", "skills"));
  const codexSkills = JSON.stringify(resolve(homedir(), ".codex", "skills"));
  const permissions = `permissions.benchmark-isolated={ extends=":workspace", filesystem={ ":root"="deny", ":minimal"="read", ${agentSkills}="read", ${codexSkills}="read" }, network={ enabled=false } }`;
  return [
    "codex",
    "exec",
    "--json",
    "--ephemeral",
    "--skip-git-repo-check",
    "--dangerously-bypass-hook-trust",
    "-c",
    'default_permissions="benchmark-isolated"',
    "-c",
    permissions,
    "-c",
    'model_reasoning_effort="high"',
    "-c",
    'approval_policy="never"',
    "-c",
    'web_search="disabled"',
    "-m",
    "gpt-5.6-sol",
    "-C",
    repo,
    "-o",
    finalPath,
    prompt,
  ];
}

export const completionExitCode = (exitCode: number, timedOut: boolean) => timedOut ? 124 : exitCode;

function parseEvents(jsonl: string) {
  const events: CodexEvent[] = [];
  let malformed = 0;
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as CodexEvent);
    } catch {
      malformed += 1;
    }
  }
  return { events, malformed };
}

function toolsFromEvent(event: CodexEvent) {
  const tools: string[] = [];
  const command = event.item?.type === "command_execution" ? event.item.command ?? "" : "";
  if (command) tools.push("shell");
  if (event.item?.type === "file_change") tools.push("apply_patch");
  for (const skill of [
    "postgresql-table-design",
    "verification-before-completion",
    "architecture-guardian",
    "code-review",
    "agency-multi-agent-systems-architect",
    "agency-application-security-engineer",
    "agency-secrets-credential-hygiene-engineer",
    "agency-privacy-engineer",
    "agency-performance-benchmarker",
    "agency-test-automation-engineer",
    "agent-kernel-evolve",
    "test-driven-development",
    "clean-code-guard",
    "test-guard",
  ]) {
    const skillPath = `${skill}/SKILL.md`;
    const shellRead = command.split(/&&|\|\||[;\n]/).map((segment) => segment.replace(/\s+#.*$/, "")).some((segment) => {
      const wrapped = segment.match(/^\s*(?:sh|bash|zsh)\s+-c\s+(['"])([\s\S]*)\1\s*$/)?.[2] ?? segment;
      return /^\s*(?:cat|sed|head|tail|less|bat|awk|perl|grep|rg)\b/.test(wrapped) &&
        wrapped.includes(skillPath) && !wrapped.slice(0, wrapped.indexOf(skillPath)).includes("<<<");
    });
    const runtimeRead = /^(?:\s*)(?:bun|node)\b/.test(command) &&
      /\b(?:Bun\.file|readFile(?:Sync)?)\b/.test(command) && command.includes(skillPath);
    if (shellRead || runtimeRead) tools.push(`skill:${skill}`);
  }
  return tools;
}

export function extractTelemetry(jsonl: string) {
  const { events, malformed } = parseEvents(jsonl);
  const observedTools = new Set<string>();
  for (const event of events) {
    for (const tool of toolsFromEvent(event)) observedTools.add(tool);
  }
  const message = events.findLast(({ item }) => item?.type === "agent_message")?.item?.text ?? "";
  const usage = events.findLast(({ type }) => type === "turn.completed")?.usage;
  const usageAvailable = Number.isFinite(usage?.input_tokens) && Number.isFinite(usage?.output_tokens) &&
    usage!.input_tokens! >= 0 && usage!.output_tokens! >= 0;
  return {
    observedTools: [...observedTools],
    finalMessage: message,
    inputTokens: usage?.input_tokens ?? 0,
    cachedInputTokens: usage?.cached_input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    usageAvailable,
    eventErrors: malformed + events.filter(({ type, item }) =>
      type === "error" || item?.type === "error" ||
      (item?.type === "command_execution" && typeof item.exit_code === "number" && item.exit_code !== 0)
    ).length,
  };
}

export const countErrorLines = (stderr: string) =>
  stderr.split("\n").filter((line) =>
    /^\s*(?:\d{4}-\d{2}-\d{2}(?:T\S+)?\s+)?error(?::|\s)/i.test(line)
  ).length;

export function resolveCheckCommand(command: string[], harnessRoot: string) {
  return command.map((argument) => {
    if (argument === "{{BUN}}") return realpathSync(Bun.which("bun") ?? process.execPath);
    return argument.startsWith("../../") ? resolve(harnessRoot, argument.slice(6)) : argument;
  });
}

const total = (numbers: number[]) => numbers.reduce((sum, number) => sum + number, 0);

export function summarizeBenchmark(results: PublicScenarioResult[]) {
  const scenariosPassed = results.filter(({ passed }) => passed).length;
  const checksPassed = total(results.map((scenario) => scenario.checksPassed));
  const checksTotal = total(results.map((scenario) => scenario.checksTotal));
  return {
    scenariosPassed,
    scenariosTotal: results.length,
    correctCompletionRate: results.length === 0 ? 0 : scenariosPassed / results.length,
    checksPassed,
    checksTotal,
    heldOutCheckRate: checksTotal === 0 ? 0 : checksPassed / checksTotal,
    testQuality: results.length === 0 ? 0 : total(results.map((scenario) => scenario.testQuality)) / results.length,
    toolSelectionAccuracy:
      results.length === 0 ? 0 : total(results.map((scenario) => scenario.toolSelectionAccuracy)) / results.length,
    humanInterventions: results.filter(({ interventionRequired }) => interventionRequired).length,
    durationMs: total(results.map((scenario) => scenario.durationMs)),
    tokens: total(results.flatMap(({ tokens }) => tokens === null ? [] : [tokens])),
    tokenScenarios: results.filter(({ tokens }) => tokens !== null).length,
    eventErrors: total(results.map((scenario) => scenario.eventErrors)),
  };
}

const percent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

function resultRow(scenario: PublicScenarioResult) {
  return `| ${scenario.scenarioId} | ${scenario.passed ? "PASS" : "FAIL"} | ${scenario.checksPassed}/${scenario.checksTotal} | ${percent(scenario.toolSelectionAccuracy)} | ${(scenario.durationMs / 1000).toFixed(1)} | ${scenario.tokens ?? "unavailable"} | ${scenario.interventionRequired ? 1 : 0} |`;
}

export function renderBaseline(run: BenchmarkRun) {
  const summary = summarizeBenchmark(run.results);
  const rows = run.results.map(resultRow).join("\n");
  return `# Baseline Evaluation

Run: \`${run.runId}\`  
Started: ${run.startedAt}  
Codex: ${run.codexVersion}  
Model: \`${run.model}\`  
Objective digest: \`${run.objectiveDigest}\`  
Configuration digest: \`${run.configDigest}\`  
Plugin inventory digest: \`${run.pluginDigest}\`

## Outcome

- Correct completion: **${summary.scenariosPassed} / ${summary.scenariosTotal}** (${percent(summary.correctCompletionRate)})
- Derived checks: **${summary.checksPassed} / ${summary.checksTotal}** (${percent(summary.heldOutCheckRate)})
- Tool-selection accuracy: **${percent(summary.toolSelectionAccuracy)}**
- Held-out test quality proxy: **${percent(summary.testQuality)}**
- Human interventions required: **${summary.humanInterventions}**
- Total elapsed agent time: **${(summary.durationMs / 1000).toFixed(1)} seconds**
- Total input plus output tokens: **${summary.tokens}**
- Structured event errors: **${summary.eventErrors}**

## Scenarios

| Scenario | Verdict | Checks | Tool selection | Seconds | Tokens | Intervention |
|---|---:|---:|---:|---:|---:|---:|
${rows}

## Measurement rules

- Verdicts are derived from the Codex process exit and scenario check exits; the agent cannot submit its own pass flag.
- The held-out check rate is the current test-quality proxy. It measures unseen behavioral assertions, not line coverage.
- Human intervention is counted when the Codex process fails to complete non-interactively.
- Token totals are reported only from Codex's structured usage event.
- This baseline is scoped to this versioned scenario set and the three recorded digests. It is not a claim of parity with any external model.
`;
}

const reduction = (control: number, candidate: number) =>
  control === 0 ? (candidate === 0 ? 0 : -1) : (control - candidate) / control;

function uniqueScenarioSetMatches(control: PublicScenarioResult[], candidate: PublicScenarioResult[]) {
  const controlIds = control.map(({ scenarioId }) => scenarioId).sort();
  const candidateIds = candidate.map(({ scenarioId }) => scenarioId).sort();
  return new Set(controlIds).size === controlIds.length &&
    new Set(candidateIds).size === candidateIds.length &&
    JSON.stringify(controlIds) === JSON.stringify(candidateIds);
}

function conservativeTokenReduction(control: PublicScenarioResult[], candidate: PublicScenarioResult[]) {
  if (candidate.some(({ tokens }) => tokens === null || tokens < 0) || control.some(({ tokens }) => tokens !== null && tokens < 0)) return -1;
  const controlLowerBound = total(control.flatMap(({ tokens }) => tokens === null ? [] : [tokens]));
  const candidateTotal = total(candidate.map(({ tokens }) => tokens!));
  return controlLowerBound === 0 ? -1 : reduction(controlLowerBound, candidateTotal);
}

export function compareBenchmarks(
  controlResults: PublicScenarioResult[],
  candidateResults: PublicScenarioResult[],
  rollbackVerified: boolean,
) {
  const control = summarizeBenchmark(controlResults);
  const candidate = summarizeBenchmark(candidateResults);
  const timeReduction = reduction(control.durationMs, candidate.durationMs);
  const tokenReduction = conservativeTokenReduction(controlResults, candidateResults);
  const errorReduction = reduction(control.eventErrors, candidate.eventErrors);
  const scenarioSetMatches = uniqueScenarioSetMatches(controlResults, candidateResults);
  const candidateEvidenceComplete = candidateResults.every((result) =>
    result.passed && result.checksTotal > 0 && result.checksPassed === result.checksTotal &&
    result.tokens !== null && result.tokens >= 0
  );
  const noQualityRegression =
    candidate.correctCompletionRate >= control.correctCompletionRate &&
    candidate.testQuality >= control.testQuality &&
    candidate.toolSelectionAccuracy >= control.toolSelectionAccuracy;
  const accepted =
    rollbackVerified &&
    scenarioSetMatches &&
    candidateEvidenceComplete &&
    candidate.scenariosPassed === candidate.scenariosTotal &&
    noQualityRegression &&
    timeReduction > 0 &&
    tokenReduction > 0 &&
    errorReduction >= 0;
  return { accepted, timeReduction, tokenReduction, errorReduction, scenarioSetMatches, control, candidate };
}

function comparisonRows(evaluation: FinalEvaluation) {
  const ids = [...new Set([...evaluation.control, ...evaluation.candidate].map(({ scenarioId }) => scenarioId))];
  return ids.map((scenarioId) => {
    const control = evaluation.control.find((result) => result.scenarioId === scenarioId);
    const candidate = evaluation.candidate.find((result) => result.scenarioId === scenarioId);
    return `| ${scenarioId} | ${candidate?.harnessPath ?? "not recorded"} | ${control ? (control.passed ? "PASS" : "FAIL") : "MISSING"} | ${candidate ? (candidate.passed ? "PASS" : "FAIL") : "MISSING"} | ${control ? (control.durationMs / 1000).toFixed(1) : "unavailable"} | ${candidate ? (candidate.durationMs / 1000).toFixed(1) : "unavailable"} | ${control?.tokens ?? "unavailable"} | ${candidate?.tokens ?? "unavailable"} |`;
  }).join("\n");
}

export function renderFinalEvaluation(evaluation: FinalEvaluation) {
  const comparison = compareBenchmarks(evaluation.control, evaluation.candidate, evaluation.rollbackVerified);
  return `# Final Evaluation

Run: \`${evaluation.runId}\`  
Started: ${evaluation.startedAt}  
Candidate verdict: **${comparison.accepted ? "ACCEPTED" : "REJECTED"}**  
Rollback verified: **${evaluation.rollbackVerified ? "yes" : "no"}**
Whole comparison state unchanged: **${evaluation.wholeRunStateUnchanged === undefined ? "not measured" : evaluation.wholeRunStateUnchanged ? "yes" : "no"}**

## Before / after

| Holdout | Candidate harness path | Control | Candidate | Control seconds | Candidate seconds | Control tokens | Candidate tokens |
|---|---|---:|---:|---:|---:|---:|---:|
${comparisonRows(evaluation)}

- Correct completion: ${comparison.control.scenariosPassed}/${comparison.control.scenariosTotal} → ${comparison.candidate.scenariosPassed}/${comparison.candidate.scenariosTotal}
- Held-out test quality proxy: ${percent(comparison.control.testQuality)} → ${percent(comparison.candidate.testQuality)}
- Tool-selection accuracy: ${percent(comparison.control.toolSelectionAccuracy)} → ${percent(comparison.candidate.toolSelectionAccuracy)}
- Time reduction: **${percent(comparison.timeReduction)}**
- Token reduction: **${percent(comparison.tokenReduction)}**
- Token reduction is conservative: every candidate token count is included and missing control usage is excluded from the control lower bound rather than treated as zero.
- Error reduction: **${percent(comparison.errorReduction)}**
- Human interventions: ${comparison.control.humanInterventions} → ${comparison.candidate.humanInterventions}

The candidate is accepted only if every unseen holdout passes, quality does not regress, both time and tokens fall, errors do not increase, and the candidate window leaves global Codex state unchanged. Whole-run state is reported separately because control hooks may mutate their own state. This evidence is scoped to this harness and is not an external-model parity claim.
`;
}
