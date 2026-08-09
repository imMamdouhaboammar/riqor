import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  createExecutionCard,
  advanceCardPhase,
  getExecutionCard,
  ExecutionPhase,
} from "../src/assurance/execution-cards";

describe("Assured Execution Cards (MetaGPT SOP Pattern)", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await (await import("node:fs/promises")).mkdtemp(join(tmpdir(), "riqor-card-test-"));
  });

  afterEach(async () => {
    await (await import("node:fs/promises")).rm(testDir, { recursive: true, force: true });
  });

  test("creates a new execution card starting at Discovery phase", async () => {
    const card = await createExecutionCard({
      cardId: "card-101",
      storageDir: testDir,
      featureTitle: "Implement Multi-Agent Auth",
      owner: "agent-architect",
    });

    expect(card.cardId).toBe("card-101");
    expect(card.currentPhase).toBe("Discovery");
    expect(card.history.length).toBe(1);
    expect(card.history[0].phase).toBe("Discovery");

    const retrieved = await getExecutionCard("card-101", testDir);
    expect(retrieved?.featureTitle).toBe("Implement Multi-Agent Auth");
  });

  test("advances phases sequentially with verified artifacts", async () => {
    await createExecutionCard({
      cardId: "card-102",
      storageDir: testDir,
      featureTitle: "Context Compression Engine",
      owner: "agent-dev",
    });

    // Discovery -> Specification
    const specResult = await advanceCardPhase({
      cardId: "card-102",
      storageDir: testDir,
      targetPhase: "Specification",
      artifactPath: "docs/specs/context.md",
      summary: "Defined compression thresholds",
    });

    expect(specResult.success).toBe(true);
    expect(specResult.card.currentPhase).toBe("Specification");

    // Specification -> TestPlan
    const testResult = await advanceCardPhase({
      cardId: "card-102",
      storageDir: testDir,
      targetPhase: "TestPlan",
      artifactPath: "test/context-compressor.test.ts",
      summary: "Added 5 unit test cases",
    });

    expect(testResult.success).toBe(true);
    expect(testResult.card.currentPhase).toBe("TestPlan");
  });

  test("rejects out-of-order phase advancement", async () => {
    await createExecutionCard({
      cardId: "card-103",
      storageDir: testDir,
      featureTitle: "Unordered Feature",
      owner: "agent-fast",
    });

    // Try skipping from Discovery directly to VerificationGate
    const skipResult = await advanceCardPhase({
      cardId: "card-103",
      storageDir: testDir,
      targetPhase: "VerificationGate",
      artifactPath: "build/out.bin",
      summary: "Skipped tests",
    });

    expect(skipResult.success).toBe(false);
    expect(skipResult.error).toContain("Invalid phase transition");
  });

  test("refuses to replace an existing card id", async () => {
    await createExecutionCard({ cardId: "card-collision", storageDir: testDir, featureTitle: "Original", owner: "agent-a" });
    await expect(createExecutionCard({ cardId: "card-collision", storageDir: testDir, featureTitle: "Replacement", owner: "agent-b" })).rejects.toThrow(/already exists/i);
    const card = await getExecutionCard("card-collision", testDir);
    expect(card?.featureTitle).toBe("Original");
    expect(card?.owner).toBe("agent-a");
  });

  test("persists execution cards with owner-only permissions", async () => {
    await createExecutionCard({ cardId: "card-private", storageDir: testDir, featureTitle: "Private", owner: "agent-a" });
    const info = await stat(join(testDir, "card-private.card.json"));
    expect(info.mode & 0o777).toBe(0o600);
  });


  test("allows only one concurrent phase advancement for a card", async () => {
    await createExecutionCard({ cardId: "card-race", storageDir: testDir, featureTitle: "Race", owner: "agent-a" });
    const attempts = await Promise.all([
      advanceCardPhase({ cardId: "card-race", storageDir: testDir, targetPhase: "Specification", artifactPath: "a.md", summary: "A" }),
      advanceCardPhase({ cardId: "card-race", storageDir: testDir, targetPhase: "Specification", artifactPath: "b.md", summary: "B" }),
    ]);
    expect(attempts.filter((attempt) => attempt.success)).toHaveLength(1);
    const card = await getExecutionCard("card-race", testDir);
    expect(card?.history).toHaveLength(2);
  });


  test("rejects path-like card identifiers", async () => {
    await expect(createExecutionCard({ cardId: "../outside", storageDir: testDir, featureTitle: "Unsafe", owner: "agent-a" })).rejects.toThrow(/cardId/i);
  });

  test("does not read an execution card through a symlink", async () => {
    const outside = join(testDir, "..", `outside-card-${Date.now()}.json`);
    await writeFile(outside, JSON.stringify({ cardId: "linked", featureTitle: "External secret", owner: "outside", currentPhase: "Discovery", createdAt: 1, updatedAt: 1, history: [] }));
    try {
      await symlink(outside, join(testDir, "linked.card.json"));
      expect(await getExecutionCard("linked", testDir)).toBeNull();
      expect(JSON.parse(await readFile(outside, "utf8")).featureTitle).toBe("External secret");
    } finally {
      await rm(outside, { force: true });
    }
  });

});
