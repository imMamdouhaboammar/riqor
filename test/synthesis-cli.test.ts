import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { join } from "node:path";

describe("Synthesis capabilities CLI integration tests", () => {
  const harnessCliPath = join(__dirname, "../src/harness-cli.ts");

  test("executes harness goal command cleanly", () => {
    const output = execSync(`bun run ${harnessCliPath} goal "Optimize Memory" --json`, {
      encoding: "utf-8",
    });
    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
    expect(parsed.goalStatus.title).toContain("Optimize Memory");
  });

  test("executes harness fuzz command cleanly", () => {
    const output = execSync(`bun run ${harnessCliPath} fuzz --json`, {
      encoding: "utf-8",
    });
    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
    expect(parsed.fuzzSamples.length).toBe(3);
  });

  test("executes harness repowise command cleanly", () => {
    const output = execSync(`bun run ${harnessCliPath} repowise --json`, {
      encoding: "utf-8",
    });
    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
    expect(parsed.repoHealth.totalFiles).toBeGreaterThan(0);
  });

  test("executes harness autoresearch command cleanly", () => {
    const output = execSync(`bun run ${harnessCliPath} autoresearch "Reduce latency" --json`, {
      encoding: "utf-8",
    });
    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
    expect(parsed.researchSummary.statement).toContain("Reduce latency");
  });
});
