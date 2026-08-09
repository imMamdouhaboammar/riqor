/**
 * Secret & Credential Scanner Engine (inspired by trufflehog)
 * Detects hardcoded secrets, API tokens, and high-entropy credentials in files and diffs.
 */

export interface SecretFinding {
  filePath: string;
  lineNumber: number;
  ruleId: string;
  ruleDescription: string;
  maskedSecret: string;
  severity: "CRITICAL" | "HIGH";
}

export interface SecretScanResult {
  hasSecrets: boolean;
  scannedFileCount: number;
  findings: SecretFinding[];
}

interface SecretPattern {
  id: string;
  description: string;
  regex: RegExp;
  severity: "CRITICAL" | "HIGH";
}

const KNOWN_SECRET_PATTERNS: SecretPattern[] = [
  {
    id: "aws-access-key",
    description: "AWS Access Key ID",
    regex: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g,
    severity: "CRITICAL",
  },
  {
    id: "openai-api-key",
    description: "OpenAI API Key",
    regex: /\bsk-[a-zA-Z0-9_-]{32,}\b/g,
    severity: "CRITICAL",
  },
  {
    id: "github-pat",
    description: "GitHub Personal Access Token",
    regex: /\bghp_[a-zA-Z0-9]{36,}\b/g,
    severity: "CRITICAL",
  },
  {
    id: "rsa-private-key",
    description: "Private Key Header",
    regex: /-----BEGIN (?:RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/g,
    severity: "CRITICAL",
  },
];

const CREDENTIAL_CONTEXT_PATTERN =
  /(?:password|passwd|secret|token|api[_-]?key|private[_-]?key|credential|auth)/i;

/**
 * Calculates Shannon Entropy for a given string token.
 */
export function calculateShannonEntropy(str: string): number {
  if (!str) return 0;
  const len = str.length;
  const frequencies = new Map<string, number>();

  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }

  let entropy = 0;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Masks a secret string to prevent leakage in logs or reports.
 */
export function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return "***MASKED***";
  }
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

/**
 * Scans string content for hardcoded secrets and high-entropy strings.
 */
export function scanContentForSecrets(content: string, filePath: string): SecretScanResult {
  const findings: SecretFinding[] = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // 1. Check known regex patterns everywhere.
    for (const pattern of KNOWN_SECRET_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(line)) !== null) {
        findings.push({
          filePath,
          lineNumber,
          ruleId: pattern.id,
          ruleDescription: pattern.description,
          maskedSecret: maskSecret(match[0]),
          severity: pattern.severity,
        });
      }
    }

    // 2. Entropy is useful only with credential-shaped surrounding context.
    // Without this guard, hashes, paths, generated IDs, and command strings create noisy findings.
    if (!CREDENTIAL_CONTEXT_PATTERN.test(line)) return;

    const stringLiteralRegex = /(?:"|')([^"'\s]{16,})(?:"|')/g;
    let stringMatch: RegExpExecArray | null;
    while ((stringMatch = stringLiteralRegex.exec(line)) !== null) {
      const rawString = stringMatch[1];
      const matchesKnownPattern = KNOWN_SECRET_PATTERNS.some((pattern) => {
        pattern.regex.lastIndex = 0;
        return pattern.regex.test(rawString);
      });

      if (!matchesKnownPattern) {
        const entropy = calculateShannonEntropy(rawString);
        if (entropy >= 4.2) {
          findings.push({
            filePath,
            lineNumber,
            ruleId: "high-entropy-secret",
            ruleDescription: `High-entropy secret detected (entropy: ${entropy.toFixed(2)})`,
            maskedSecret: maskSecret(rawString),
            severity: "HIGH",
          });
        }
      }
    }
  });

  return {
    hasSecrets: findings.length > 0,
    scannedFileCount: 1,
    findings,
  };
}

/**
 * Scans multiple files for secrets.
 */
export function scanFilesForSecrets(files: Array<{ path: string; content: string }>): SecretScanResult {
  const allFindings: SecretFinding[] = [];

  for (const file of files) {
    const result = scanContentForSecrets(file.content, file.path);
    allFindings.push(...result.findings);
  }

  return {
    hasSecrets: allFindings.length > 0,
    scannedFileCount: files.length,
    findings: allFindings,
  };
}
