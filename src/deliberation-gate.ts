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

export type ConvergenceStatus = "converged" | "stalled" | "in_progress";

export interface ConvergenceResult {
  status: ConvergenceStatus;
  turnsExecuted: number;
  currentPassRate: number;
  reason: string;
}

export function evaluateConvergenceLoop(
  history: Array<{ passCount: number; failCount: number }>,
  maxTurns = 10,
): ConvergenceResult {
  if (!history || history.length === 0) {
    return {
      status: "in_progress",
      turnsExecuted: 0,
      currentPassRate: 0,
      reason: "No execution turns recorded yet.",
    };
  }

  const latest = history[history.length - 1];
  const total = latest.passCount + latest.failCount;
  const currentPassRate = total > 0 ? latest.passCount / total : 0;

  if (latest.failCount === 0 && latest.passCount > 0) {
    return {
      status: "converged",
      turnsExecuted: history.length,
      currentPassRate: 1.0,
      reason: "100% evidence assertions verified cleanly.",
    };
  }

  if (history.length >= maxTurns) {
    return {
      status: "stalled",
      turnsExecuted: history.length,
      currentPassRate,
      reason: `Reached maximum turn limit of ${maxTurns} without 100% convergence.`,
    };
  }

  // Circuit breaker: Check if last 3 turns showed no increase in passCount
  if (history.length >= 3) {
    const recent = history.slice(-3);
    const firstPass = recent[0].passCount;
    const isStagnant = recent.every((turn) => turn.passCount <= firstPass);
    if (isStagnant) {
      return {
        status: "stalled",
        turnsExecuted: history.length,
        currentPassRate,
        reason: "Evidence verification stalled with zero progress over 3 consecutive turns.",
      };
    }
  }

  return {
    status: "in_progress",
    turnsExecuted: history.length,
    currentPassRate,
    reason: `In progress: ${latest.passCount}/${total} checks passing.`,
  };
}
