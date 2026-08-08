import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { assertIsolatableRepo } from "./checks.js";
import { runOfflineSecurityScan, type SecurityFinding } from "./security-scan.js";

export interface SkepticalDiffSummary {
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface SkepticalVerificationResult {
  status: "passed" | "failed" | "pending";
  mutationsDetected: boolean;
  uncommittedFiles: string[];
  diffSummary: SkepticalDiffSummary;
  securityFindings?: SecurityFinding[];
  reasons: string[];
  timestamp: string;
}

export function runSkepticalVerification(repoRoot: string = process.cwd()): SkepticalVerificationResult {
  const resolvedRoot = resolve(repoRoot);
  assertIsolatableRepo(resolvedRoot);

  const timestamp = new Date().toISOString();
  const reasons: string[] = [];
  let mutationsDetected = false;
  let uncommittedFiles: string[] = [];
  const diffSummary: SkepticalDiffSummary = { filesChanged: 0, insertions: 0, deletions: 0 };
  let securityFindings: SecurityFinding[] = [];

  try {
    const statusOutput = execSync("git status --porcelain", {
      cwd: resolvedRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    if (statusOutput.length > 0) {
      mutationsDetected = true;
      uncommittedFiles = statusOutput
        .split("\n")
        .map((line) => line.trim().slice(3))
        .filter(Boolean);
    }
  } catch (error) {
    reasons.push("Unable to inspect git status in repository.");
    return {
      status: "failed",
      mutationsDetected: false,
      uncommittedFiles: [],
      diffSummary,
      reasons,
      timestamp,
    };
  }

  try {
    const diffStat = execSync("git diff --stat", {
      cwd: resolvedRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    if (diffStat.length > 0) {
      const lastLine = diffStat.split("\n").pop() || "";
      const filesMatch = lastLine.match(/(\d+)\s+files? changed/);
      const insMatch = lastLine.match(/(\d+)\s+insertions?\(\+\)/);
      const delMatch = lastLine.match(/(\d+)\s+deletions?\(-\)/);

      if (filesMatch) diffSummary.filesChanged = Number.parseInt(filesMatch[1], 10);
      if (insMatch) diffSummary.insertions = Number.parseInt(insMatch[1], 10);
      if (delMatch) diffSummary.deletions = Number.parseInt(delMatch[1], 10);
    }
  } catch {
    // Non-fatal if diff stat fails
  }

  if (mutationsDetected) {
    const securityScan = runOfflineSecurityScan(uncommittedFiles, resolvedRoot);
    if (!securityScan.passed) {
      securityFindings = securityScan.findings;
      reasons.push(`Security audit warning: ${securityFindings.length} security finding(s) detected in uncommitted mutations.`);
    }

    if (uncommittedFiles.length > 15) {
      reasons.push(`High mutation churn: ${uncommittedFiles.length} uncommitted files detected without verification.`);
    } else {
      reasons.push(`Uncommitted mutations present (${uncommittedFiles.length} files changed). Verification required.`);
    }
  } else {
    reasons.push("Working tree clean. No uncommitted mutations detected.");
  }

  let status: "passed" | "failed" | "pending" = mutationsDetected ? "pending" : "passed";
  if (securityFindings.some((f) => f.severity === "high")) {
    status = "failed";
  }

  return {
    status,
    mutationsDetected,
    uncommittedFiles,
    diffSummary,
    securityFindings,
    reasons,
    timestamp,
  };
}
