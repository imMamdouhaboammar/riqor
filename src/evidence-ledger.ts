import { mkdir, readFile, appendFile } from "node:fs/promises";
import { join } from "node:path";

export type EvidenceLedgerEntry = Readonly<{
  kind: "mutation" | "verification" | "checkpoint" | "audit";
  summary: string;
  timestamp?: string;
  status?: "pending" | "success" | "failure";
}>;

export function formatEvidenceLedgerEntry(entry: EvidenceLedgerEntry): string {
  const time = entry.timestamp ?? new Date().toISOString();
  const statusBadge = entry.status ? ` [${entry.status.toUpperCase()}]` : "";
  return `### [${time}] ${entry.kind.toUpperCase()}${statusBadge}\n- ${entry.summary}\n\n`;
}

export async function appendEvidenceLedger(
  targetDir: string,
  entry: EvidenceLedgerEntry
): Promise<string> {
  const riqorDir = join(targetDir, ".riqor");
  await mkdir(riqorDir, { recursive: true });
  const ledgerPath = join(riqorDir, "EVIDENCE.md");

  let header = "";
  try {
    await readFile(ledgerPath, "utf8");
  } catch {
    header = `# Riqor Closed-Loop Evidence Ledger\n\nAutomated evidence trail for workspace mutations, verification passes, and checkpoints.\n\n---\n\n`;
  }

  const formatted = `${header}${formatEvidenceLedgerEntry(entry)}`;
  await appendFile(ledgerPath, formatted, "utf8");
  return ledgerPath;
}

export async function readEvidenceLedger(targetDir: string): Promise<string | null> {
  const ledgerPath = join(targetDir, ".riqor", "EVIDENCE.md");
  try {
    return await readFile(ledgerPath, "utf8");
  } catch {
    return null;
  }
}
