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

// AgentShield Real-Time Security Inspection (Inspired by ECC AgentShield)

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+all\s+(?:previous\s+)?instructions/i,
  /system\s+override\s*:/i,
  /bypass\s+security\s+(?:checks|rules|policies)/i,
  /reveal\s+(?:secret|auth|api_key|password|token)/i,
  /you\s+are\s+now\s+in\s+dan\s+mode/i,
];

const DESTRUCTIVE_TEXT_PATTERNS = [
  /\bdrop\s+database\b/i,
  /\bdrop\s+table\b/i,
  /(?:^|\s)mkfs(?:\.[^\s]+)?(?:\s|$)/i,
  /(?:^|\s)dd\s+[^\n]*\bof=\/dev\//i,
];

function shellTokens(segment: string): string[] {
  const tokens: string[] = [];
  const matcher = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|([^\s]+)/g;
  for (const match of segment.matchAll(matcher)) {
    tokens.push((match[1] ?? match[2] ?? match[3] ?? "").replace(/\\([\\"'])/g, "$1"));
  }
  return tokens;
}

function isCommandToken(token: string, command: string): boolean {
  return token === command || token.endsWith(`/${command}`);
}

function isDangerousRm(tokens: readonly string[]): boolean {
  const rmIndex = tokens.findIndex((token) => isCommandToken(token, "rm"));
  if (rmIndex < 0) return false;

  let recursive = false;
  let force = false;
  let optionsEnded = false;
  const targets: string[] = [];
  for (const token of tokens.slice(rmIndex + 1)) {
    if (!optionsEnded && token === "--") {
      optionsEnded = true;
      continue;
    }
    if (!optionsEnded && token.startsWith("--")) {
      if (token === "--recursive") recursive = true;
      if (token === "--force") force = true;
      continue;
    }
    if (!optionsEnded && /^-[^-]/.test(token)) {
      const flags = token.slice(1);
      if (/[rR]/.test(flags)) recursive = true;
      if (/f/.test(flags)) force = true;
      continue;
    }
    targets.push(token);
  }
  if (!recursive || !force) return false;
  return targets.some((target) => target === "~" || target.startsWith("~/") || target.startsWith("/"));
}

function isDangerousGitReset(tokens: readonly string[]): boolean {
  const gitIndex = tokens.findIndex((token) => isCommandToken(token, "git"));
  if (gitIndex < 0) return false;
  const resetIndex = tokens.findIndex((token, index) => index > gitIndex && token === "reset");
  if (resetIndex < 0) return false;
  return tokens.slice(resetIndex + 1).some((token) => token === "--hard" || token.startsWith("--hard="));
}

export function detectPromptInjection(input: string): { blocked: boolean; reason?: string } {
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { blocked: true, reason: `AgentShield: Prompt injection pattern detected (${pattern.source})` };
    }
  }
  return { blocked: false };
}

export function detectDestructiveMutation(command: string): { blocked: boolean; reason?: string } {
  const segments = command.split(/(?:&&|\|\||;|\n)/).map((segment) => segment.trim()).filter(Boolean);
  for (const segment of segments) {
    const tokens = shellTokens(segment);
    if (isDangerousRm(tokens)) return { blocked: true, reason: "AgentShield: Destructive command blocked: recursive forced removal" };
    if (isDangerousGitReset(tokens)) return { blocked: true, reason: "AgentShield: Destructive command blocked: git hard reset" };
  }
  for (const pattern of DESTRUCTIVE_TEXT_PATTERNS) {
    if (pattern.test(command)) return { blocked: true, reason: `AgentShield: destructive command blocked (${pattern.source})` };
  }
  return { blocked: false };
}

export type HarnessTarget = "codex" | "claude" | "cursor" | "gemini";

export function isHarnessTarget(value: string): value is HarnessTarget {
  return value === "codex" || value === "claude" || value === "cursor" || value === "gemini";
}

export function exportHarnessConfig(targetFormat: HarnessTarget, harnessVersion = "development"): string {
  const config = {
    harnessVersion,
    target: targetFormat,
    security: "AgentShield-enabled",
    processGates: ["TDD-Enforced", "Skeptical-Verification", "Karpathy-Unslop-Grader"],
    createdAt: new Date().toISOString(),
  };
  return JSON.stringify(config, null, 2);
}
