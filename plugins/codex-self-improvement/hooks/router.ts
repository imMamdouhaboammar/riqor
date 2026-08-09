import { harnessPathForProfile, type HarnessPath, type TaskProfile } from "./paths";

export type { TaskProfile } from "./paths";

export type RoutingDecision = Readonly<{
  profile: TaskProfile;
  path: HarnessPath;
  skills: readonly string[];
  guidance: string;
}>;

function decision(profile: TaskProfile, skills: string[], guidance: string): RoutingDecision {
  const selectedPath = harnessPathForProfile(profile);
  return Object.freeze({
    profile,
    path: selectedPath,
    skills: Object.freeze([...new Set([...skills, ...selectedPath.curatedSkills])]),
    guidance,
  });
}

const decisions: Record<TaskProfile, RoutingDecision> = {
  database: decision(
    "database",
    ["postgresql-table-design", "verification-before-completion"],
    "Inspect data contracts, tenant boundaries, constraints, indexes, migrations, reuse candidates, and query evidence before changing the schema",
  ),
  debugging: decision(
    "debugging",
    ["systematic-debugging", "test-driven-development", "verification-before-completion"],
    "Reproduce the symptom, trace the data flow to the root cause, change one variable, then prove the regression check fails before and passes after",
  ),
  review: decision(
    "review",
    ["verification-before-completion", "requesting-code-review"],
    "Fix the review base and specification, isolate reviewer contexts, inspect the real diff and callers, then verify accepted findings independently",
  ),
  security: decision(
    "security",
    ["security-scan", "threat-model", "verification-before-completion"],
    "Map the trust boundary, attacker-controlled inputs, authorization checks, secret locations, and failure modes before proposing a change",
  ),
  ui: decision(
    "ui",
    ["ui-review-loop", "test-driven-development", "verification-before-completion"],
    "Inspect the rendered flow, interaction states, accessibility, responsive behavior, and RTL or localization requirements with browser evidence",
  ),
  research: decision(
    "research",
    ["find-docs", "context7", "verification-before-completion"],
    "Use current primary documentation for unstable APIs, separate sourced facts from inference, and pin the exact version or date used",
  ),
  privacy: decision(
    "privacy",
    ["verification-before-completion"],
    "Map data fields to purpose, stores, retention, and deletion paths using metadata and synthetic records only",
  ),
  performance: decision(
    "performance",
    ["verification-before-completion"],
    "Freeze the local workload and environment, compare control and candidate distributions, and reject gains that regress correctness or resource ceilings",
  ),
  evolution: decision(
    "evolution",
    ["self-improvement-loop", "verification-before-completion"],
    "Capture a repeated evidence-backed pattern, draft a bounded playbook, evaluate it on holdouts, and leave publication for explicit review",
  ),
  focus: decision(
    "focus",
    ["verification-before-completion"],
    "Break down complex work into single-action micro-steps, verify each step immediately, and avoid multi-subsystem cognitive overload",
  ),
  engineering: decision(
    "engineering",
    ["evidence-engineering", "test-driven-development", "verification-before-completion"],
    "Define observable acceptance criteria, inspect existing patterns and reuse candidates, make the smallest coherent change, and run focused checks before project gates",
  ),
};

const patterns: Array<[TaskProfile, RegExp]> = [
  ["focus", /\b(focus|adhd|micro[- ]step|step[- ]by[- ]step|overwhelmed)\b/i],
  ["evolution", /\b(self[- ]?evolv|playbook|workflow synthesis|capture learning|agent learning|repeatable workflow)\w*/i],
  ["privacy", /\b(pii|personal data|data minimization|retention|consent|dsar|right to deletion|right to erasure|gdpr|privacy)\b/i],
  ["performance", /\b(benchmark|latency|throughput|load test|stress test|cpu profile|memory profile|core web vitals|requests per second|p95|p99)\b/i],
  ["database", /\b(postgres(?:ql)?|schema|migration|foreign key|index|constraint|tenant|row.level|rls|sql)\b/i],
  ["security", /\b(security|authorization|authentication|oauth|permission|privilege|injection|xss|csrf|ssrf|secret|token|vulnerab|threat)\w*/i],
  ["debugging", /\b(bug|failure|failing|broken|wrong|intermittent|flaky|root cause|regression|crash|timeout|deadlock|race condition)\b/i],
  ["ui", /\b(ui|ux|layout|react|component|css|responsive|accessibility|a11y|rtl|visual|browser|screen|frontend)\b/i],
  ["research", /\b(latest|current (?:api )?documentation|current docs|official (?:api )?documentation|docs|research|look up|search|verify online|context7)\b/i],
  ["review", /\b(review|audit|completion claim|verdict|code quality|pull request|\bpr\b)\b/i],
];

export function classifyPrompt(prompt: string): RoutingDecision {
  for (const [profile, pattern] of patterns) {
    if (pattern.test(prompt)) return decisions[profile];
  }
  return decisions.engineering;
}

export function routingContext(prompt: string) {
  const selected = classifyPrompt(prompt);
  return [
    "Codex Self Improvement route",
    `Profile: ${selected.profile}`,
    `Harness path: ${selected.path.id}`,
    `Relevant skills to inspect when installed: ${selected.skills.join(", ")}`,
    `Evidence target: ${selected.path.evidence[0]}`,
    selected.guidance,
    "Routing is not proof that a skill loaded, an action ran, or a check passed",
  ].join("\n").slice(0, 900);
}
