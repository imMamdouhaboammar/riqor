import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { executeKernelCommand } from "./bun-kernel.js";

export interface ConventionCheckResult {
  rule: string;
  passed: boolean;
  message: string;
}

export interface ConventionAuditReport {
  overallPassed: boolean;
  checks: ConventionCheckResult[];
  timestamp: string;
}

export function auditRepositoryConventions(repoRoot: string = process.cwd()): ConventionAuditReport {
  const resolvedRoot = resolve(repoRoot);
  const checks: ConventionCheckResult[] = [];

  // Check 1: License File
  const hasLicense = existsSync(join(resolvedRoot, "LICENSE")) || existsSync(join(resolvedRoot, "LICENSE.md"));
  checks.push({
    rule: "license-presence",
    passed: hasLicense,
    message: hasLicense ? "LICENSE file present." : "Missing LICENSE file in repository root.",
  });

  // Check 2: Lockfile Hygiene
  const hasBunLock = existsSync(join(resolvedRoot, "bun.lock")) || existsSync(join(resolvedRoot, "bun.lockb"));
  checks.push({
    rule: "lockfile-hygiene",
    passed: hasBunLock,
    message: hasBunLock ? "Bun lockfile present." : "Missing bun.lock or bun.lockb.",
  });

  // Check 3: Documentation Completeness
  const hasReadme = existsSync(join(resolvedRoot, "README.md"));
  checks.push({
    rule: "documentation-completeness",
    passed: hasReadme,
    message: hasReadme ? "README.md present." : "Missing README.md in repository root.",
  });

  // Check 4: Conventional Commit Message Format
  try {
    const gitLog = executeKernelCommand(["git", "log", "-1", "--pretty=%s"], resolvedRoot);
    if (gitLog.exitCode === 0 && gitLog.stdout) {
      const commitMsg = gitLog.stdout.trim();
      const conventionalRegex = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-]+\))?: .+/i;
      const isConventional = conventionalRegex.test(commitMsg);
      checks.push({
        rule: "conventional-commits",
        passed: isConventional,
        message: isConventional
          ? `Latest commit follow conventional commit standard: "${commitMsg}"`
          : `Latest commit does not follow conventional commit standard: "${commitMsg}"`,
      });
    }
  } catch {
    // Non-fatal if git log fails
  }

  const overallPassed = checks.every((c) => c.passed);
  return {
    overallPassed,
    checks,
    timestamp: new Date().toISOString(),
  };
}
