export type TaskProfile =
  | "database"
  | "debugging"
  | "review"
  | "security"
  | "ui"
  | "research"
  | "privacy"
  | "performance"
  | "evolution"
  | "engineering";

export type HarnessPathId =
  | "architecture-conformance"
  | "controlled-evolution"
  | "evidence-loop"
  | "independent-review"
  | "privacy-minimization"
  | "secure-change"
  | "performance-evidence"
  | "e2e-evidence";

export type HarnessPath = Readonly<{
  id: HarnessPathId;
  objective: string;
  curatedSkills: readonly string[];
  evidence: readonly string[];
  guardrails: readonly string[];
  automaticActions: readonly string[];
  requiresExplicitApproval: readonly string[];
}>;

function path(definition: HarnessPath): HarnessPath {
  return Object.freeze({
    ...definition,
    curatedSkills: Object.freeze([...definition.curatedSkills]),
    evidence: Object.freeze([...definition.evidence]),
    guardrails: Object.freeze([...definition.guardrails]),
    automaticActions: Object.freeze([...definition.automaticActions]),
    requiresExplicitApproval: Object.freeze([...definition.requiresExplicitApproval]),
  });
}

export const harnessPaths = Object.freeze([
  path({
    id: "architecture-conformance",
    objective: "Prevent duplicate capabilities and architecture drift before non-trivial cross-module or contract changes",
    curatedSkills: ["architecture-guardian"],
    evidence: ["current architecture and reuse evidence", "post-change conformance result or an explicit not-applicable reason"],
    guardrails: ["review mode is the default", "never create a baseline, exception, or broader contract to make a check pass"],
    automaticActions: [],
    requiresExplicitApproval: ["enable strict architecture enforcement", "create or update a baseline", "add an architecture exception"],
  }),
  path({
    id: "controlled-evolution",
    objective: "Capture reusable workflow learning as a reviewed proposal without silently changing durable agent behavior",
    curatedSkills: ["agent-kernel-evolve"],
    evidence: ["repeated failure or correction evidence", "candidate playbook with acceptance and rollback criteria"],
    guardrails: ["proposal-only by default", "store no prompt, source content, credentials, or command output in durable memory"],
    automaticActions: [],
    requiresExplicitApproval: ["publish durable memory", "install lifecycle hooks", "start a daemon", "modify environment vault state"],
  }),
  path({
    id: "evidence-loop",
    objective: "Move from a reproduced symptom or acceptance criterion to fresh focused checks and an evidence-scoped completion claim",
    curatedSkills: [],
    evidence: ["reproduction or failing check before the change", "focused passing check after the final mutation"],
    guardrails: ["change one causal variable at a time", "never convert confidence, a diff, or prior agent output into proof"],
    automaticActions: [],
    requiresExplicitApproval: ["expand scope beyond the reviewed request"],
  }),
  path({
    id: "independent-review",
    objective: "Review implementation against repository standards and the originating specification using isolated reviewer contexts",
    curatedSkills: ["code-review", "agency-multi-agent-systems-architect"],
    evidence: ["fixed review base and concrete specification", "findings reconciled against the real diff and fresh checks"],
    guardrails: ["reviewers do not inherit the author verdict", "reviewer output is a lead and not verification evidence"],
    automaticActions: [],
    requiresExplicitApproval: ["send repository content to an external model", "create more than two reviewer agents", "change code during review"],
  }),
  path({
    id: "privacy-minimization",
    objective: "Verify collection purpose, retention, deletion, and data minimization without copying personal data into harness artifacts",
    curatedSkills: ["agency-privacy-engineer"],
    evidence: ["field-level purpose and store inventory using metadata", "retention and deletion-path checks with synthetic records"],
    guardrails: ["use synthetic identifiers in fixtures and reports", "retain no personal data or free-text payloads in harness evidence"],
    automaticActions: [],
    requiresExplicitApproval: ["inspect live personal data", "execute deletion outside a disposable fixture", "contact a third-party processor"],
  }),
  path({
    id: "secure-change",
    objective: "Trace trust boundaries, authorization, and credential handling while keeping secret values outside prompts and artifacts",
    curatedSkills: ["agency-application-security-engineer", "agency-secrets-credential-hygiene-engineer"],
    evidence: ["attacker-controlled source to security-sensitive sink trace", "focused security regression check after the final mutation"],
    guardrails: ["prefer installed Codex Security tools for repository scans", "record secret locations and fingerprints only, never values"],
    automaticActions: [],
    requiresExplicitApproval: ["read live secret values", "rotate or revoke credentials", "scan an external target"],
  }),
  path({
    id: "performance-evidence",
    objective: "Compare performance under a fixed local or synthetic workload without turning production traffic into a benchmark fixture",
    curatedSkills: ["agency-performance-benchmarker"],
    evidence: ["reproducible workload, environment digest, and warm-up policy", "control and candidate latency, throughput, resource, and error measurements"],
    guardrails: ["use the same environment and workload for control and candidate", "correctness, safety, and resource ceilings override speed gains"],
    automaticActions: [],
    requiresExplicitApproval: ["run load against a shared or production target", "increase cost or resource limits", "install a new load generator"],
  }),
  path({
    id: "e2e-evidence",
    objective: "Validate critical user flows with isolated test data, condition-based waits, and traceable browser artifacts",
    curatedSkills: ["agency-test-automation-engineer"],
    evidence: ["deterministic user-flow assertion in a test environment", "failure trace, screenshot, or video when the check fails"],
    guardrails: ["never retry until green without diagnosing the flake", "use no production account, credential, or personal data"],
    automaticActions: [],
    requiresExplicitApproval: ["run against production", "create persistent external test data", "upload traces or screenshots externally"],
  }),
] as const);

const pathById = new Map(harnessPaths.map((candidate) => [candidate.id, candidate]));
const profilePaths: Record<TaskProfile, HarnessPathId> = {
  database: "architecture-conformance",
  debugging: "evidence-loop",
  review: "independent-review",
  security: "secure-change",
  ui: "e2e-evidence",
  research: "evidence-loop",
  privacy: "privacy-minimization",
  performance: "performance-evidence",
  evolution: "controlled-evolution",
  engineering: "architecture-conformance",
};

export function harnessPathById(id: HarnessPathId): HarnessPath {
  const selected = pathById.get(id);
  if (!selected) throw new Error(`missing harness path ${id}`);
  return selected;
}

export function harnessPathForProfile(profile: TaskProfile): HarnessPath {
  return harnessPathById(profilePaths[profile]);
}
