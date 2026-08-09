import { describe, expect, test } from "bun:test";
import { RepoIntelligenceAnalyzer, type RepoHealthReport } from "../src/diagnostics/repo-intelligence";
import { join, resolve } from "node:path";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

describe("RepoIntelligenceAnalyzer (repowise-inspired repository analyzer)", () => {
  const sampleRepoPath = resolve(__dirname, "../src");

  test("analyzes repository structure and calculates file statistics", async () => {
    const analyzer = new RepoIntelligenceAnalyzer(sampleRepoPath);
    const report: RepoHealthReport = await analyzer.analyzeRepository();

    expect(report.totalFiles).toBeGreaterThan(0);
    expect(report.totalLinesOfCode).toBeGreaterThan(0);
    expect(report.modules.length).toBeGreaterThan(0);
    expect(typeof report.healthScore).toBe("number");
    expect(report.healthScore).toBeGreaterThanOrEqual(0);
    expect(report.healthScore).toBeLessThanOrEqual(100);
  });

  test("calculates change risk impact score for a set of modified files", async () => {
    const analyzer = new RepoIntelligenceAnalyzer(sampleRepoPath);
    const riskAssessment = await analyzer.assessChangeRisk([
      "cli.ts",
      "harness-cli.ts",
    ]);

    expect(riskAssessment.riskLevel).toBeDefined();
    expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(riskAssessment.riskLevel);
    expect(riskAssessment.affectedModules.length).toBeGreaterThan(0);
    expect(riskAssessment.riskScore).toBeGreaterThan(0);
  });

  test("handles empty file lists or non-existent directories gracefully", async () => {
    const analyzer = new RepoIntelligenceAnalyzer(sampleRepoPath);
    const riskAssessment = await analyzer.assessChangeRisk([]);

    expect(riskAssessment.riskLevel).toBe("LOW");
    expect(riskAssessment.riskScore).toBe(0);
  });

  test("skips internal worktrees and symlinked files", async () => {
    const testDir = await mkdtemp(join(tmpdir(), "riqor-repowise-boundary-"));
    try {
      const internal = join(testDir, ".worktrees", "nested");
      await mkdir(internal, { recursive: true });
      await writeFile(join(internal, "noise.json"), "{}\n");
      const outside = join(testDir, "outside-source.txt");
      await writeFile(outside, "secret\n");
      await symlink(outside, join(testDir, "linked.json"));

      const analyzer = new RepoIntelligenceAnalyzer(testDir);
      const report = await analyzer.analyzeRepository();
      expect(report.modules.map((module) => module.relativePath)).not.toContain(".worktrees/nested/noise.json");
      expect(report.modules.map((module) => module.relativePath)).not.toContain("linked.json");
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

});
