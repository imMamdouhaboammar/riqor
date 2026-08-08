import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

export interface SecurityFinding {
  ruleId: string;
  severity: "high" | "medium" | "low";
  file: string;
  line: number;
  description: string;
  snippet?: string;
}

export interface SecurityScanResult {
  passed: boolean;
  findings: SecurityFinding[];
  scannedFilesCount: number;
  timestamp: string;
}

// Security pattern heuristics inspired by SecureAI-Scan
const SECRET_PATTERNS: Array<{ id: string; pattern: RegExp; desc: string; severity: "high" | "medium" }> = [
  { id: "SEC-001", pattern: /(?:sk-|api[_-]?key|secret[_-]?key)["']?\s*[:=]\s*["']?([a-zA-Z0-9_\-]{20,})["']?/i, desc: "Potential hardcoded API key or secret token detected", severity: "high" },
  { id: "SEC-002", pattern: /(?:ghp_|gho_|github_pat_)[a-zA-Z0-9_]{36,}/, desc: "Hardcoded GitHub Personal Access Token detected", severity: "high" },
  { id: "SEC-003", pattern: /AKIA[0-9A-Z]{16}/, desc: "Hardcoded AWS Access Key ID detected", severity: "high" },
  { id: "SEC-004", pattern: /-----BEGIN\s+(?:RSA|EC|PGP|PRIVATE)\s+KEY-----/, desc: "Hardcoded private key block detected", severity: "high" },
  { id: "SEC-005", pattern: /ey[A-Za-z0-9-_=]+\.ey[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/, desc: "Potential hardcoded JWT token detected", severity: "medium" },
];

const AI_SINK_PATTERNS: Array<{ id: string; pattern: RegExp; desc: string; severity: "high" | "medium" | "low" }> = [
  { id: "SEC-010", pattern: /eval\s*\(\s*.*(?:prompt|user_input|input|request|body)/i, desc: "Unsafe evaluation of user prompt or input in code", severity: "high" },
  { id: "SEC-011", pattern: /execSync\s*\(\s*`[^`]*\$\{.*(?:prompt|input|user|query).*\}`/i, desc: "Potential command injection in dynamic shell execution", severity: "high" },
  { id: "SEC-012", pattern: /SystemPrompt\s*:\s*.*(?:\$\{.*user|req\.body)/i, desc: "Direct concatenation of untrusted user input into System Prompt (Prompt Injection Risk)", severity: "medium" },
  { id: "SEC-013", pattern: /mcpServers\s*:\s*\{[^}]*["'](?:command|exec)["']\s*:\s*["'](?:curl|wget|nc|bash|sh)["']/i, desc: "Unsafe MCP tool configuration with arbitrary shell execution", severity: "medium" },
];

export function scanFileForSecurity(filePath: string, repoRoot: string = process.cwd()): SecurityFinding[] {
  const fullPath = resolve(repoRoot, filePath);
  if (!existsSync(fullPath)) return [];

  const findings: SecurityFinding[] = [];
  try {
    const content = readFileSync(fullPath, "utf8");
    const lines = content.split("\n");

    lines.forEach((lineText, index) => {
      const lineNum = index + 1;

      for (const rule of SECRET_PATTERNS) {
        if (rule.pattern.test(lineText)) {
          findings.push({
            ruleId: rule.id,
            severity: rule.severity,
            file: filePath,
            line: lineNum,
            description: rule.desc,
            snippet: lineText.trim().slice(0, 100),
          });
        }
      }

      for (const rule of AI_SINK_PATTERNS) {
        if (rule.pattern.test(lineText)) {
          findings.push({
            ruleId: rule.id,
            severity: rule.severity,
            file: filePath,
            line: lineNum,
            description: rule.desc,
            snippet: lineText.trim().slice(0, 100),
          });
        }
      }
    });
  } catch {
    // Non-fatal if file cannot be read
  }

  return findings;
}

export function runOfflineSecurityScan(filePaths: string[], repoRoot: string = process.cwd()): SecurityScanResult {
  const allFindings: SecurityFinding[] = [];

  for (const file of filePaths) {
    const findings = scanFileForSecurity(file, repoRoot);
    allFindings.push(...findings);
  }

  const highOrMedium = allFindings.filter((f) => f.severity === "high" || f.severity === "medium");

  return {
    passed: highOrMedium.length === 0,
    findings: allFindings,
    scannedFilesCount: filePaths.length,
    timestamp: new Date().toISOString(),
  };
}
