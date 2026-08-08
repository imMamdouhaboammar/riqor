import { describe, expect, it } from "bun:test";
import { runOfflineSecurityScan, scanFileForSecurity } from "../src/security-scan";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("offline security scanner", () => {
  it("detects hardcoded secrets in mutated files", () => {
    const tempFile = join(process.cwd(), "temp-secret-test.ts");
    try {
      writeFileSync(tempFile, 'const apiKey = "sk-proj-123456789012345678901234567890";', "utf8");
      const findings = scanFileForSecurity("temp-secret-test.ts");
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].ruleId).toBe("SEC-001");
      expect(findings[0].severity).toBe("high");
    } finally {
      if (existsSync(tempFile)) unlinkSync(tempFile);
    }
  });

  it("detects unsafe prompt evaluation sinks", () => {
    const tempFile = join(process.cwd(), "temp-sink-test.ts");
    try {
      writeFileSync(tempFile, 'eval("user_input + prompt");', "utf8");
      const findings = scanFileForSecurity("temp-sink-test.ts");
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].ruleId).toBe("SEC-010");
    } finally {
      if (existsSync(tempFile)) unlinkSync(tempFile);
    }
  });

  it("returns passed=true when no security findings exist", () => {
    const result = runOfflineSecurityScan(["package.json"]);
    expect(result.passed).toBe(true);
    expect(result.findings.length).toBe(0);
  });
});
