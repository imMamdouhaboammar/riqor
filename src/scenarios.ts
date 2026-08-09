import type { ScenarioDefinition } from "./harness";
import type { HarnessPathId } from "../plugins/codex-self-improvement/hooks/paths";

export type BenchmarkCheck = { id: string; command: string[] };

export type ExecutableScenario = {
  id: string;
  prompt: string;
  expectedTools: string[];
  harnessPath: HarnessPathId;
  checks: BenchmarkCheck[];
};

export type BenchmarkScenario = ScenarioDefinition & ExecutableScenario;

const codingPrompt =
  "Work in this synthetic benchmark repository. Read TASK.md and the relevant source and tests, preserve the stated contract, make the smallest root-cause change, run focused checks, and report changed files, checks, and anything not verified.";

export const scenarios: BenchmarkScenario[] = [
  {
    id: "long-multistage",
    harnessPath: "architecture-conformance",
    category: "long_multistage",
    expectedTools: ["shell", "apply_patch"],
    prompt: `${codingPrompt} Complete every stage rather than stopping after the first passing example.`,
    checks: [
      { id: "visible-tests", command: ["bun", "test"] },
      { id: "held-out-behavior", command: ["bun", "../../graders/long-multistage.ts", "."] },
    ],
  },
  {
    id: "unfamiliar-repo",
    harnessPath: "architecture-conformance",
    category: "unfamiliar_repo",
    expectedTools: ["shell", "apply_patch"],
    prompt: `${codingPrompt} Infer the local interval conventions from the repository before editing.`,
    checks: [
      { id: "visible-tests", command: ["bun", "test"] },
      { id: "held-out-behavior", command: ["bun", "../../graders/unfamiliar-repo.ts", "."] },
    ],
  },
  {
    id: "unclear-bug",
    harnessPath: "evidence-loop",
    category: "unclear_bug",
    expectedTools: ["shell", "apply_patch"],
    prompt: `${codingPrompt} The report is intentionally symptom-level; trace all callers and fix the shared cause.`,
    checks: [
      { id: "visible-tests", command: ["bun", "test"] },
      { id: "held-out-behavior", command: ["bun", "../../graders/unclear-bug.ts", "."] },
    ],
  },
  {
    id: "cross-project",
    harnessPath: "architecture-conformance",
    category: "cross_project",
    expectedTools: ["shell", "apply_patch"],
    prompt: `${codingPrompt} Keep the API and CLI behavior aligned through the existing shared package.`,
    checks: [
      { id: "visible-tests", command: ["bun", "test"] },
      { id: "held-out-behavior", command: ["bun", "../../graders/cross-project.ts", "."] },
    ],
  },
  {
    id: "implicit-discovery",
    harnessPath: "architecture-conformance",
    category: "implicit_discovery",
    expectedTools: ["shell", "apply_patch", "skill:postgresql-table-design"],
    prompt:
      "Audit and repair the PostgreSQL multi-tenant schema in TASK.md and schema.sql. Discover and use any relevant installed capability without being told its name. Preserve scope, add only evidence-backed constraints or indexes, and record the concrete findings in REVIEW.md.",
    checks: [{ id: "schema-contract", command: ["bun", "../../graders/implicit-discovery.ts", "."] }],
  },
  {
    id: "context-recovery",
    harnessPath: "evidence-loop",
    category: "context_recovery",
    expectedTools: ["shell", "apply_patch"],
    prompt:
      "Your prior context is gone. Resume this synthetic repository from SESSION_CHECKPOINT.md, verify the checkpoint against the live files, finish the implementation without redoing completed work, run the relevant checks, and report evidence and remaining uncertainty.",
    checks: [
      { id: "visible-tests", command: ["bun", "test"] },
      { id: "held-out-behavior", command: ["bun", "../../graders/context-recovery.ts", "."] },
    ],
  },
  {
    id: "agent-review",
    harnessPath: "independent-review",
    category: "agent_review",
    expectedTools: ["shell", "apply_patch"],
    prompt:
      "Independently review the previous agent's completion claim in TASK.md and REVIEW_FROM_AGENT.md. Inspect the real authorization flow, repair confirmed defects only, add a focused regression test, run it, and do not inherit the prior verdict.",
    checks: [
      { id: "visible-tests", command: ["bun", "test"] },
      { id: "security-regression", command: ["bun", "../../graders/agent-review.ts", "."] },
    ],
  },
  {
    id: "unsupported-completion",
    harnessPath: "independent-review",
    category: "unsupported_completion",
    expectedTools: ["shell"],
    prompt:
      "Audit the completion claim in COMPLETION.md without modifying repository files. Run the claimed check and inspect the implementation. Return exactly three non-empty lines: `TEST_EVIDENCE: <command> exit <integer>`, `IMPLEMENTATION_EVIDENCE: <file and concrete finding>`, then `VERDICT: PASS` or `VERDICT: FAIL`.",
    checks: [
      {
        id: "claim-verdict",
        command: ["bun", "../../graders/unsupported-completion.ts", ".", ".harness-final.txt", "{{BUN}}"],
      },
    ],
  },
];

export type UnslopGradeResult = {
  passed: boolean;
  score: number; // 0.0 - 1.0 scale
  reasons: string[];
};

export function karpathyUnslopGrader(diffContent: string): UnslopGradeResult {
  const lines = diffContent.split("\n").map((l) => l.trim());
  const addedLines = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++"));
  const removedLines = lines.filter((line) => line.startsWith("-") && !line.startsWith("---"));

  const reasons: string[] = [];
  let score = 1.0;

  if (addedLines.length === 0) {
    return { passed: true, score: 1.0, reasons: [] };
  }

  // 1. Comment Density Check (Karpathy rule: Prefer clean self-describing code over conversational comment walls)
  const commentLines = addedLines.filter((l) => {
    const trimmed = l.slice(1).trim();
    return trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("#");
  });
  const commentRatio = commentLines.length / addedLines.length;
  if (commentRatio > 0.35 && addedLines.length > 5) {
    score -= 0.35;
    reasons.push(`High comment density (${Math.round(commentRatio * 100)}% of diff is comments) - prefer self-describing code.`);
  }

  // 2. Over-abstraction / Wrapper Slop Check
  const slopPatterns = [
    /class\s+\w+Factory/i,
    /class\s+\w+Wrapper/i,
    /class\s+\w+Manager/i,
    /abstract\s+class/i,
    /interface\s+I\w+Adapter/i,
  ];
  let slopMatches = 0;
  for (const line of addedLines) {
    for (const pattern of slopPatterns) {
      if (pattern.test(line)) {
        slopMatches++;
      }
    }
  }
  if (slopMatches >= 2) {
    score -= 0.35;
    reasons.push(`Detected over-abstraction / wrapper slop (${slopMatches} patterns matched) - prefer direct functions over verbose wrappers.`);
  }


  // 3. Diff Expansion Ratio Check (For small fixes, don't write 200 lines when 5 will do)
  if (removedLines.length > 0 && addedLines.length > removedLines.length * 6 && addedLines.length > 40) {
    score -= 0.25;
    reasons.push(`Diff expansion bloat (${addedLines.length} lines added vs ${removedLines.length} removed) - prefer minimal-line edits.`);
  }

  const finalScore = Math.max(0, Math.round(score * 100) / 100);
  const passed = finalScore >= 0.7;

  return {
    passed,
    score: finalScore,
    reasons,
  };
}

