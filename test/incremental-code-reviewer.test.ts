import { describe, expect, test } from "bun:test";
import { auditDiff, reviewCodeChanges } from "../src/incremental-code-reviewer.js";

describe("IncrementalCodeReviewer (inspired by alibaba/open-code-review)", () => {
  test("categorizes security findings as BLOCKING severity", () => {
    const fakeAwsKey = ["AKIA", "IOSFODNN7EXAMPLE"].join("");
    const diff = `
+ const key = "${fakeAwsKey}";
+ eval("user_prompt");
    `;

    const result = auditDiff(diff, "src/auth.ts");

    expect(result.passed).toBe(false);
    expect(result.findings.some((finding) => finding.pillar === "SECURITY" && finding.severity === "BLOCKING")).toBe(true);
  });

  test("flags performance concerns as WARNING severity", () => {
    const code = `
+ for (let i = 0; i < items.length; i++) {
+   fs.readFileSync(items[i]);
+ }
    `;

    const result = auditDiff(code, "src/loader.ts");

    expect(result.findings.some((finding) => finding.pillar === "PERFORMANCE" && finding.severity === "WARNING")).toBe(true);
    expect(result.findings.find((finding) => finding.pillar === "PERFORMANCE")?.suggestion).toContain("async");
  });

  test("flags design & anti-pattern issues in code", () => {
    const code = `
+ function processData(data: any): any {
+   try {
+     doSomething();
+   } catch (e) {}
+ }
    `;

    const result = auditDiff(code, "src/service.ts");

    expect(result.findings.some((finding) => finding.pillar === "DESIGN" && finding.message.includes("empty catch"))).toBe(true);
  });

  test("passes clean, well-structured diffs", () => {
    const cleanDiff = `
+ export function multiply(a: number, b: number): number {
+   return a * b;
+ }
    `;

    const result = auditDiff(cleanDiff, "src/math.ts");

    expect(result.passed).toBe(true);
    expect(result.findings.length).toBe(0);
  });

  test("reviews multiple file changes and returns structured report", () => {
    const files = [
      { path: "src/math.ts", diff: "+ const x = 1;" },
      { path: "src/unsafe.ts", diff: '+ eval("prompt");' },
    ];

    const report = reviewCodeChanges(files);

    expect(report.totalFilesAudited).toBe(2);
    expect(report.passed).toBe(false);
    expect(report.blockingCount).toBeGreaterThan(0);
  });
});
