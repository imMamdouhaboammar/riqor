import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { rm, mkdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CognitiveMemoryLedger } from "../src/cognitive-memory";

describe("Cognitive Memory Ledger (COG-second-brain integration)", () => {
  let testDataDir: string;
  let ledger: CognitiveMemoryLedger;

  beforeEach(async () => {
    testDataDir = join(tmpdir(), `riqor-cog-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDataDir, { recursive: true });
    ledger = new CognitiveMemoryLedger(testDataDir);
  });

  afterEach(async () => {
    await rm(testDataDir, { recursive: true, force: true });
  });

  test("adds and retrieves cognitive entries for a project digest", async () => {
    const projectRoot = "/test/repo/project-a";
    await ledger.addEntry(projectRoot, {
      category: "architecture",
      title: "Use Bun for dev and Node for published package",
      pattern: "Never depend on Bun in published package installer scripts",
    });

    const entries = await ledger.getEntriesForProject(projectRoot);
    expect(entries.length).toBe(1);
    expect(entries[0].category).toBe("architecture");
    expect(entries[0].title).toBe("Use Bun for dev and Node for published package");
  });

  test("isolates memory between different project roots via SHA-256 digest", async () => {
    await ledger.addEntry("/repo/alpha", {
      category: "convention",
      title: "Alpha rule",
      pattern: "Alpha specific pattern",
    });
    await ledger.addEntry("/repo/beta", {
      category: "convention",
      title: "Beta rule",
      pattern: "Beta specific pattern",
    });

    const alphaEntries = await ledger.getEntriesForProject("/repo/alpha");
    const betaEntries = await ledger.getEntriesForProject("/repo/beta");

    expect(alphaEntries.length).toBe(1);
    expect(alphaEntries[0].title).toBe("Alpha rule");
    expect(betaEntries.length).toBe(1);
    expect(betaEntries[0].title).toBe("Beta rule");
  });

  test("enforces max capacity (50 items) via FIFO pruning", async () => {
    const projectRoot = "/test/repo/large";
    for (let i = 1; i <= 55; i++) {
      await ledger.addEntry(projectRoot, {
        category: "failure-pattern",
        title: `Pattern ${i}`,
        pattern: `Detail ${i}`,
      });
    }

    const entries = await ledger.getEntriesForProject(projectRoot);
    expect(entries.length).toBe(50);
    expect(entries[0].title).toBe("Pattern 6");
    expect(entries[49].title).toBe("Pattern 55");
  });

  test("enforces owner-only file permissions (0600)", async () => {
    const projectRoot = "/test/repo/perm-check";
    await ledger.addEntry(projectRoot, {
      category: "guardrail",
      title: "Permission test",
      pattern: "Verify file stats",
    });

    const filePath = ledger.getStoragePath();
    const fileStats = await stat(filePath);
    // Mask with 0o777 to check file mode permissions
    const mode = fileStats.mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
