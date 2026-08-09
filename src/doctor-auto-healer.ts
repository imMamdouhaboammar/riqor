/**
 * Self-Healing Diagnostic & Auto-Remediation Engine (inspired by millionco/react-doctor)
 * Powering `riqor doctor --fix` to safely detect and auto-heal environment drift.
 */

import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface HealAction {
  category: "shell-integration" | "capsule-cleanup" | "provenance-reconciliation";
  description: string;
  success: boolean;
  error?: string;
}

export interface HealResult {
  healed: boolean;
  actionsApplied: HealAction[];
}

export interface RepairShellMarkersResult {
  success: boolean;
  backupCreated: boolean;
  backupPath?: string;
}

const BEGIN_MARKER = "# BEGIN RIQOR MANAGED BLOCK";
const END_MARKER = "# END RIQOR MANAGED BLOCK";

/**
 * Idempotently repairs shell markers in .zshenv while creating a backup.
 */
export function repairShellMarkers(zshenvPath: string): RepairShellMarkersResult {
  if (!existsSync(zshenvPath)) {
    // Write new clean block
    const initialContent = `${BEGIN_MARKER}\n# Managed by Riqor\n${END_MARKER}\n`;
    writeFileSync(zshenvPath, initialContent, "utf8");
    return { success: true, backupCreated: false };
  }

  const existingContent = readFileSync(zshenvPath, "utf8");

  // Create backup before mutating
  const backupPath = `${zshenvPath}.bak.${Date.now()}`;
  copyFileSync(zshenvPath, backupPath);

  // Strip any malformed/partial Riqor block
  let cleaned = existingContent;
  const beginIndex = cleaned.indexOf(BEGIN_MARKER);

  if (beginIndex !== -1) {
    const endIndex = cleaned.indexOf(END_MARKER);
    if (endIndex !== -1 && endIndex > beginIndex) {
      // Remove complete existing block
      cleaned = cleaned.slice(0, beginIndex) + cleaned.slice(endIndex + END_MARKER.length);
    } else {
      // Malformed/unclosed block - slice from beginIndex to end of string or next section
      cleaned = cleaned.slice(0, beginIndex);
    }
  }

  // Trim and append clean Riqor managed block
  const trimmed = cleaned.trim();
  const managedBlock = `${BEGIN_MARKER}\n# Managed by Riqor\n${END_MARKER}`;
  const newContent = trimmed ? `${trimmed}\n\n${managedBlock}\n` : `${managedBlock}\n`;

  writeFileSync(zshenvPath, newContent, "utf8");

  return {
    success: true,
    backupCreated: true,
    backupPath,
  };
}

/**
 * Runs automated healing across the environment.
 */
export function autoHealEnvironment(options?: { targetHome?: string; zshenvPath?: string }): HealResult {
  const actions: HealAction[] = [];
  const userHome = options?.targetHome || homedir();
  const zshenv = options?.zshenvPath || join(userHome, ".zshenv");

  // 1. Repair Shell Markers
  try {
    const shellResult = repairShellMarkers(zshenv);
    actions.push({
      category: "shell-integration",
      description: "Repaired and verified Riqor managed block in .zshenv",
      success: shellResult.success,
    });
  } catch (err) {
    actions.push({
      category: "shell-integration",
      description: "Failed to repair shell markers",
      success: false,
      error: String(err),
    });
  }

  const allSuccess = actions.every((a) => a.success);

  return {
    healed: allSuccess,
    actionsApplied: actions,
  };
}
