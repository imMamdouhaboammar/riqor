import { describe, expect, it } from "bun:test";
import { auditRepositoryConventions } from "../src/convention-auditor.js";

describe("convention compliance auditor", () => {
  it("audits repository conventions cleanly", () => {
    const report = auditRepositoryConventions(process.cwd());
    expect(report).toHaveProperty("overallPassed");
    expect(Array.isArray(report.checks)).toBe(true);
    expect(report.checks.length).toBeGreaterThan(0);
    expect(typeof report.timestamp).toBe("string");
  });
});
