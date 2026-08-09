import { expect, test, describe } from "bun:test";
import { parseGitDiffHunks, filterDiagnosticsByDiff, formatDiagnosticReport } from "../src/diagnostics/diff-reporter.js";

describe("diff-reporter (reviewdog-inspired diagnostic gate)", () => {
  const sampleDiff = `
diff --git a/src/index.ts b/src/index.ts
index 1234567..89abcdef 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -10,4 +10,6 @@ function hello() {
   const x = 1;
+  const y = 2;
+  const z = 3;
   return x;
 }
`;

  test("parses git diff hunks into a map of modified lines per file", () => {
    const map = parseGitDiffHunks(sampleDiff);
    expect(map.has("src/index.ts")).toBe(true);
    const lines = map.get("src/index.ts")!;
    expect(lines.has(11)).toBe(true); // line 11 (const y = 2;)
    expect(lines.has(12)).toBe(true); // line 12 (const z = 3;)
    expect(lines.has(10)).toBe(false); // line 10 (unchanged)
  });

  test("filters out diagnostics on unmodified lines", () => {
    const diffMap = parseGitDiffHunks(sampleDiff);
    const diagnostics = [
      { file: "src/index.ts", line: 10, column: 3, severity: "error" as const, message: "Unused variable x", ruleId: "no-unused-vars" },
      { file: "src/index.ts", line: 11, column: 3, severity: "warning" as const, message: "Unused variable y", ruleId: "no-unused-vars" },
      { file: "src/other.ts", line: 5, column: 1, severity: "error" as const, message: "Syntax error", ruleId: "syntax-error" },
    ];

    const filtered = filterDiagnosticsByDiff(diagnostics, diffMap);
    expect(filtered.length).toBe(1);
    expect(filtered[0].file).toBe("src/index.ts");
    expect(filtered[0].line).toBe(11);
    expect(filtered[0].message).toBe("Unused variable y");
  });

  test("formats filtered diagnostics into a markdown summary report", () => {
    const diagnostics = [
      { file: "src/index.ts", line: 11, column: 3, severity: "warning" as const, message: "Unused variable y", ruleId: "no-unused-vars" },
    ];
    const report = formatDiagnosticReport(diagnostics);
    expect(report).toContain("### 🔍 Diff-Aware Diagnostic Report");
    expect(report).toContain("`src/index.ts:11:3`");
    expect(report).toContain("Unused variable y");
  });
});
