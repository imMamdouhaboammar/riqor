import { formatCrystallizedRulesHighDensity, loadCrystallizedRules } from "./crystallized-rules.js";
import { getSessionTelemetry } from "./telemetry-mcp.js";

export function calculateEnvironmentDelta(repoRoot: string = process.cwd()): string {
  const telemetry = getSessionTelemetry(repoRoot);
  const rules = loadCrystallizedRules(repoRoot);
  const formattedRules = formatCrystallizedRulesHighDensity(rules);

  const lines: string[] = [];
  lines.push("[RIQOR ENVIRONMENT DELTA]");
  lines.push(`• Active Branch: ${telemetry.activeBranch} (Commit: ${telemetry.latestCommitHash})`);
  lines.push(
    `• Workspace Mutations: ${telemetry.metrics.uncommittedFilesCount} files changed (+${telemetry.metrics.linesInserted} / -${telemetry.metrics.linesDeleted} lines)`,
  );
  lines.push(`• Skeptical Verification: ${telemetry.verification.status.toUpperCase()}`);
  if (telemetry.verification.reasons.length > 0) {
    lines.push(`• Rationale: ${telemetry.verification.reasons[0]}`);
  }
  if (formattedRules) {
    lines.push("");
    lines.push(formattedRules);
  }

  return lines.join("\n");
}
