/**
 * Structured Incremental Code Reviewer Engine (inspired by alibaba/open-code-review)
 * Audits code diffs across 4 pillars: SECURITY, PERFORMANCE, DESIGN, STYLE.
 */

import { scanContentForSecrets } from "./secret-scanner.js";

export type ReviewPillar = "SECURITY" | "PERFORMANCE" | "DESIGN" | "STYLE";
export type ReviewSeverity = "BLOCKING" | "WARNING" | "INFO";

export interface ReviewFinding {
  pillar: ReviewPillar;
  severity: ReviewSeverity;
  file: string;
  line: number;
  message: string;
  suggestion: string;
}

export interface IncrementalReviewResult {
  passed: boolean;
  file: string;
  findings: ReviewFinding[];
}

export interface CodeChangesReport {
  totalFilesAudited: number;
  passed: boolean;
  blockingCount: number;
  warningCount: number;
  infoCount: number;
  findings: ReviewFinding[];
}

/**
 * Audits a single file diff or code block.
 */
export function auditDiff(diffContent: string, filePath: string): IncrementalReviewResult {
  const findings: ReviewFinding[] = [];
  const lines = diffContent.split("\n");

  // 1. Check for Security issues via SecretScanner & unsafe evaluation
  const secretResult = scanContentForSecrets(diffContent, filePath);
  for (const f of secretResult.findings) {
    findings.push({
      pillar: "SECURITY",
      severity: "BLOCKING",
      file: filePath,
      line: f.lineNumber,
      message: `Security vulnerability detected: ${f.ruleDescription}`,
      suggestion: "Remove hardcoded credentials and load from environment variables.",
    });
  }

  // 2. Check for Performance issues (e.g. sync I/O inside loops)
  if (/(?:for|while)\s*\([^)]*\)\s*\{[^}]*fs\.(?:readFileSync|writeFileSync|execSync)/s.test(diffContent)) {
    findings.push({
      pillar: "PERFORMANCE",
      severity: "WARNING",
      file: filePath,
      line: 1,
      message: "Synchronous file/process execution inside a loop causes I/O blocking.",
      suggestion: "Use async operations or process files in parallel outside the loop.",
    });
  }

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Check for eval() sink
    if (/eval\s*\(/.test(line)) {
      findings.push({
        pillar: "SECURITY",
        severity: "BLOCKING",
        file: filePath,
        line: lineNum,
        message: "Dynamic code evaluation via eval() is unsafe.",
        suggestion: "Avoid eval() and use safe parsing or explicit control flows.",
      });
    }

    // 3. Check for Design issues (e.g. empty catch blocks)
    if (/catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(line)) {
      findings.push({
        pillar: "DESIGN",
        severity: "WARNING",
        file: filePath,
        line: lineNum,
        message: "Silent empty catch block swallows errors.",
        suggestion: "Log error or handle exception explicitly to prevent silent runtime failures.",
      });
    }
  });

  const hasBlocking = findings.some((f) => f.severity === "BLOCKING");

  return {
    passed: !hasBlocking,
    file: filePath,
    findings,
  };
}

/**
 * Reviews code changes across multiple files and returns an aggregated report.
 */
export function reviewCodeChanges(files: Array<{ path: string; diff: string }>): CodeChangesReport {
  const allFindings: ReviewFinding[] = [];

  for (const file of files) {
    const res = auditDiff(file.diff, file.path);
    allFindings.push(...res.findings);
  }

  const blockingCount = allFindings.filter((f) => f.severity === "BLOCKING").length;
  const warningCount = allFindings.filter((f) => f.severity === "WARNING").length;
  const infoCount = allFindings.filter((f) => f.severity === "INFO").length;

  return {
    totalFilesAudited: files.length,
    passed: blockingCount === 0,
    blockingCount,
    warningCount,
    infoCount,
    findings: allFindings,
  };
}
