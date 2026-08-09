import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

export type ModuleInfo = Readonly<{
  relativePath: string;
  linesOfCode: number;
  sizeBytes: number;
  hasTests: boolean;
}>;

export type RepoHealthReport = Readonly<{
  totalFiles: number;
  totalLinesOfCode: number;
  healthScore: number;
  modules: readonly ModuleInfo[];
}>;

export type ChangeRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ChangeRiskAssessment = Readonly<{
  riskLevel: ChangeRiskLevel;
  riskScore: number;
  affectedModules: readonly string[];
  recommendations: readonly string[];
}>;

export class RepoIntelligenceAnalyzer {
  private readonly targetDir: string;

  constructor(targetDir: string) {
    if (!targetDir) {
      throw new Error("targetDir path must be provided");
    }
    this.targetDir = targetDir;
  }

  public async analyzeRepository(): Promise<RepoHealthReport> {
    const files = await this.scanDirectory(this.targetDir);
    const modules: ModuleInfo[] = [];

    let totalLinesOfCode = 0;

    for (const filePath of files) {
      if (filePath.endsWith(".ts") || filePath.endsWith(".js") || filePath.endsWith(".json")) {
        try {
          const content = await readFile(filePath, "utf-8");
          const stats = await stat(filePath);
          const lines = content.split("\n").length;

          totalLinesOfCode += lines;
          modules.push(
            Object.freeze({
              relativePath: relative(this.targetDir, filePath),
              linesOfCode: lines,
              sizeBytes: stats.size,
              hasTests: filePath.includes(".test.") || filePath.includes(".spec."),
            })
          );
        } catch {
          // Ignore unreadable or temporary files
        }
      }
    }

    // Health score heuristic based on module test ratio and average size
    const testCount = modules.filter((m) => m.hasTests).length;
    const testRatio = modules.length > 0 ? testCount / modules.length : 1;
    const rawScore = Math.min(100, Math.max(0, Math.round(70 + testRatio * 30)));

    return Object.freeze({
      totalFiles: modules.length,
      totalLinesOfCode,
      healthScore: rawScore,
      modules: Object.freeze(modules),
    });
  }

  public async assessChangeRisk(modifiedFiles: readonly string[]): Promise<ChangeRiskAssessment> {
    if (!modifiedFiles || modifiedFiles.length === 0) {
      return Object.freeze({
        riskLevel: "LOW",
        riskScore: 0,
        affectedModules: [],
        recommendations: ["No files modified."],
      });
    }

    const affectedModules: string[] = [];
    let weight = 0;

    for (const file of modifiedFiles) {
      affectedModules.push(file);
      if (file.includes("cli") || file.includes("harness")) {
        weight += 35;
      } else if (file.includes("kernel") || file.includes("security")) {
        weight += 25;
      } else {
        weight += 10;
      }
    }

    const riskScore = Math.min(100, weight);
    let riskLevel: ChangeRiskLevel = "LOW";

    if (riskScore >= 75) {
      riskLevel = "CRITICAL";
    } else if (riskScore >= 50) {
      riskLevel = "HIGH";
    } else if (riskScore >= 25) {
      riskLevel = "MEDIUM";
    }

    const recommendations: string[] = [];
    if (riskLevel === "CRITICAL" || riskLevel === "HIGH") {
      recommendations.push("High-impact CLI/Kernel files modified; run complete test suite before merging.");
    } else {
      recommendations.push("Targeted component modifications detected; run relevant unit tests.");
    }

    return Object.freeze({
      riskLevel,
      riskScore,
      affectedModules: Object.freeze(affectedModules),
      recommendations: Object.freeze(recommendations),
    });
  }

  private async scanDirectory(dir: string): Promise<string[]> {
    const ignoredDirectories = new Set([
      "node_modules", ".git", "dist", ".worktrees", ".riqor", ".planning", "graphify-out", "coverage",
    ]);
    let results: string[] = [];
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (ignoredDirectories.has(entry.name)) continue;
          const sub = await this.scanDirectory(fullPath);
          results = results.concat(sub);
        } else if (entry.isFile()) {
          results.push(fullPath);
        }
      }
    } catch {
      // Directory read error fallback
    }
    return results;
  }
}
