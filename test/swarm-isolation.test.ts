import { expect, test, describe, afterEach } from "bun:test";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SwarmSessionIsolation } from "../src/assurance/swarm-isolation.js";

describe("SwarmSessionIsolation (prime-agent inspired multi-agent isolation)", () => {
  const baseTestDir = join(tmpdir(), `riqor-swarm-test-${Date.now()}`);

  afterEach(async () => {
    try {
      await rm(baseTestDir, { recursive: true, force: true });
    } catch {}
  });

  test("creates a session-isolated workspace directory", async () => {
    const session = new SwarmSessionIsolation({
      sessionId: "agent-session-alpha",
      baseDir: baseTestDir,
    });

    const workspace = await session.initializeWorkspace();
    expect(workspace.sessionId).toBe("agent-session-alpha");
    expect(workspace.workspaceDir).toContain("agent-session-alpha");
    expect(existsSync(workspace.workspaceDir)).toBe(true);
  });

  test("acquires session-scoped lock without colliding with other sessions", async () => {
    const sessionA = new SwarmSessionIsolation({
      sessionId: "agent-a",
      baseDir: baseTestDir,
    });
    const sessionB = new SwarmSessionIsolation({
      sessionId: "agent-b",
      baseDir: baseTestDir,
    });

    await sessionA.initializeWorkspace();
    await sessionB.initializeWorkspace();

    const lockA = await sessionA.acquireScopedLock("db-migration");
    const lockB = await sessionB.acquireScopedLock("db-migration");

    expect(lockA.acquired).toBe(true);
    expect(lockB.acquired).toBe(true);
    expect(lockA.lockPath).not.toBe(lockB.lockPath);
  });

  test("cleans up session workspace on termination", async () => {
    const session = new SwarmSessionIsolation({
      sessionId: "agent-cleanup-test",
      baseDir: baseTestDir,
    });

    const workspace = await session.initializeWorkspace();
    expect(existsSync(workspace.workspaceDir)).toBe(true);

    await session.cleanup();
    expect(existsSync(workspace.workspaceDir)).toBe(false);
  });
});
