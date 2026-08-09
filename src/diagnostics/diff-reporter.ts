export interface DiagnosticItem {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "info";
  message: string;
  ruleId?: string;
}

export type ModifiedLinesMap = Map<string, Set<number>>;

export function parseGitDiffHunks(diffText: string): ModifiedLinesMap {
  const fileMap: ModifiedLinesMap = new Map();
  const lines = diffText.split("\n");
  let currentFile: string | null = null;
  let currentNewLine = 0;

  for (const line of lines) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.substring(6).trim();
      if (!fileMap.has(currentFile)) {
        fileMap.set(currentFile, new Set());
      }
      continue;
    }

    if (line.startsWith("@@ ")) {
      // e.g. @@ -10,4 +10,6 @@
      const match = line.match(/@@ -\d+,\d+ \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        currentNewLine = parseInt(match[1], 10);
      }
      continue;
    }

    if (currentFile && fileMap.has(currentFile)) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        fileMap.get(currentFile)!.add(currentNewLine);
        currentNewLine++;
      } else if (!line.startsWith("-")) {
        // unchanged line increments new line number
        currentNewLine++;
      }
    }
  }

  return fileMap;
}

export function filterDiagnosticsByDiff(
  diagnostics: DiagnosticItem[],
  diffMap: ModifiedLinesMap
): DiagnosticItem[] {
  return diagnostics.filter((diag) => {
    // Normalize path separators
    const normalizedPath = diag.file.replace(/\\/g, "/");
    const modifiedLines = diffMap.get(normalizedPath);
    if (!modifiedLines) return false;
    return modifiedLines.has(diag.line);
  });
}

export function formatDiagnosticReport(diagnostics: DiagnosticItem[]): string {
  if (diagnostics.length === 0) {
    return "### 🔍 Diff-Aware Diagnostic Report\n\n✅ No diagnostics detected in modified lines.";
  }

  let report = "### 🔍 Diff-Aware Diagnostic Report\n\n";
  report += `Found ${diagnostics.length} diagnostic issue(s) in modified lines:\n\n`;

  for (const diag of diagnostics) {
    const icon = diag.severity === "error" ? "❌" : diag.severity === "warning" ? "⚠️" : "ℹ️";
    const ruleStr = diag.ruleId ? ` \`[${diag.ruleId}]\`` : "";
    report += `- ${icon} \`${diag.file}:${diag.line}:${diag.column}\`${ruleStr}: ${diag.message}\n`;
  }

  return report;
}
