import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { acquireSwarmLock, releaseSwarmLock, isSwarmLockActive } from "../src/assurance/swarm-lock";

describe("Swarm Multi-Agent Concurrency Lock", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await (await import("node:fs/promises")).mkdtemp(join(tmpdir(), "riqor-swarm-test-"));
  });

  afterEach(async () => {
    await (await import("node:fs/promises")).rm(testDir, { recursive: true, force: true });
  });

  test("acquires lock successfully when no lock exists", async () => {
    const lockName = "feature-auth";
    const lock = await acquireSwarmLock({ lockName, lockDir: testDir, ownerId: "agent-1", ttlMs: 5000 });

    expect(lock.acquired).toBe(true);
    expect(lock.ownerId).toBe("agent-1");
    expect(await isSwarmLockActive({ lockName, lockDir: testDir })).toBe(true);

    await releaseSwarmLock(lock);
    expect(await isSwarmLockActive({ lockName, lockDir: testDir })).toBe(false);
  });

  test("prevents second agent from acquiring active lock on same feature", async () => {
    const lockName = "feature-payments";
    const lock1 = await acquireSwarmLock({ lockName, lockDir: testDir, ownerId: "agent-1", ttlMs: 10000 });
    expect(lock1.acquired).toBe(true);

    const lock2 = await acquireSwarmLock({ lockName, lockDir: testDir, ownerId: "agent-2", ttlMs: 10000 });
    expect(lock2.acquired).toBe(false);
    expect(lock2.ownerId).toBe("agent-1");

    await releaseSwarmLock(lock1);

    // After release, agent-2 can acquire
    const lock3 = await acquireSwarmLock({ lockName, lockDir: testDir, ownerId: "agent-2", ttlMs: 10000 });
    expect(lock3.acquired).toBe(true);
    await releaseSwarmLock(lock3);
  });

  test("recovers stale lock when ttl has expired", async () => {
    const lockName = "feature-stale";
    const lock1 = await acquireSwarmLock({ lockName, lockDir: testDir, ownerId: "agent-dead", ttlMs: 50 }); // 50ms TTL
    expect(lock1.acquired).toBe(true);

    // Sleep for 60ms to let TTL expire
    await new Promise((resolve) => setTimeout(resolve, 60));

    const lock2 = await acquireSwarmLock({ lockName, lockDir: testDir, ownerId: "agent-alive", ttlMs: 5000 });
    expect(lock2.acquired).toBe(true);
    expect(lock2.ownerId).toBe("agent-alive");

    await releaseSwarmLock(lock2);
  });
  test("allows exactly one winner under concurrent acquisition", async () => {
    const lockName = "feature-race";
    const attempts = await Promise.all(
      Array.from({ length: 24 }, (_, index) =>
        acquireSwarmLock({ lockName, lockDir: testDir, ownerId: `agent-${index}`, ttlMs: 10000 }),
      ),
    );
    const winners = attempts.filter((attempt) => attempt.acquired);
    expect(winners).toHaveLength(1);
    await releaseSwarmLock(winners[0]!);
  });

  test("replaces a hostile symlink lock without touching its target", async () => {
    const outside = join(testDir, "..", `outside-lock-${Date.now()}.json`);
    const target = JSON.stringify({ ownerId: "outside", acquiredAt: Date.now(), ttlMs: 60000, token: "outside-token" });
    await writeFile(outside, target);
    try {
      await symlink(outside, join(testDir, "hostile.lock"));
      const result = await acquireSwarmLock({ lockName: "hostile", lockDir: testDir, ownerId: "local", ttlMs: 10000 });
      expect(result.acquired).toBe(true);
      expect(await readFile(outside, "utf8")).toBe(target);
      await releaseSwarmLock(result);
    } finally {
      await rm(outside, { force: true });
    }
  });

});
