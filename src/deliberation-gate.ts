import { auditRepositoryConventions } from "./convention-auditor.js";
import { runSkepticalVerification } from "./skeptical-verifier.js";

export interface DeliberationConsensus {
  consensus: "approved" | "rejected" | "conditional";
  voteCount: {
    pass: number;
    fail: number;
    total: number;
  };
  details: string[];
  timestamp: string;
}

export function runDeliberationGate(repoRoot: string = process.cwd()): DeliberationConsensus {
  const skeptical = runSkepticalVerification(repoRoot);
  const conventions = auditRepositoryConventions(repoRoot);

  const details: string[] = [];
  let passCount = 0;
  let failCount = 0;

  // Vote 1: Skeptical Verifier
  if (skeptical.status === "passed") {
    passCount += 1;
    details.push("[PASS] Skeptical Verifier: Working tree clean and verified.");
  } else {
    failCount += 1;
    details.push(`[FAIL] Skeptical Verifier: ${skeptical.reasons[0] || "Uncommitted mutations detected."}`);
  }

  // Vote 2: Conventions Audit
  if (conventions.overallPassed) {
    passCount += 1;
    details.push("[PASS] Convention Auditor: All repository conventions passed.");
  } else {
    failCount += 1;
    details.push("[FAIL] Convention Auditor: One or more convention rules failed.");
  }

  const total = passCount + failCount;
  let consensus: "approved" | "rejected" | "conditional" = "rejected";

  if (passCount === total) {
    consensus = "approved";
  } else if (passCount > 0) {
    consensus = "conditional";
  }

  return {
    consensus,
    voteCount: {
      pass: passCount,
      fail: failCount,
      total,
    },
    details,
    timestamp: new Date().toISOString(),
  };
}
