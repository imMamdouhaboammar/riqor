import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  initTaskLedger,
  addTask,
  updateTaskStatus,
  getNextExecutableTasks,
  readTaskLedger,
  generatePlanMarkdown,
  type TaskItem,
} from "../src/task-plan-ledger.js";
import { acquireSwarmLock, releaseSwarmLock } from "../src/assurance/swarm-lock";


const TEST_DIR = join(import.meta.dir, ".tmp-task-plan-ledger-test");

beforeEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("Task Plan Ledger & Swarm Coordinator", () => {
  test("initializes an empty ledger and persists state file", async () => {
    const options = { ledgerDir: TEST_DIR, ownerId: "agent-alpha" };
    const state = await initTaskLedger(options);

    expect(state.version).toBe("1.0.0");
    expect(state.tasks).toEqual([]);

    const diskState = await readTaskLedger(TEST_DIR);
    expect(diskState).not.toBeNull();
    expect(diskState?.version).toBe("1.0.0");
  });

  test("adds tasks and manages DAG dependencies", async () => {
    const options = { ledgerDir: TEST_DIR, ownerId: "agent-alpha" };
    await initTaskLedger(options);

    const task1 = await addTask(options, {
      id: "task-1",
      title: "Core Architecture Setup",
      status: "pending",
    });

    const task2 = await addTask(options, {
      id: "task-2",
      title: "Feature Implementation",
      status: "pending",
      dependsOn: ["task-1"],
    });

    expect(task1.id).toBe("task-1");
    expect(task2.dependsOn).toEqual(["task-1"]);

    // Task 1 has no dependencies -> executable
    // Task 2 depends on task 1 (which is still pending) -> NOT executable yet
    const executableBefore = await getNextExecutableTasks(options);
    expect(executableBefore.map((t) => t.id)).toEqual(["task-1"]);

    // Complete task 1
    await updateTaskStatus(options, "task-1", "completed");

    // Now task 2 should be executable!
    const executableAfter = await getNextExecutableTasks(options);
    expect(executableAfter.map((t) => t.id)).toEqual(["task-2"]);
  });

  test("updates task status with error details on failure", async () => {
    const options = { ledgerDir: TEST_DIR, ownerId: "agent-alpha" };
    await initTaskLedger(options);

    await addTask(options, {
      id: "task-fail",
      title: "Risky Operation",
      status: "in_progress",
    });

    const updated = await updateTaskStatus(
      options,
      "task-fail",
      "failed",
      "Compilation timeout on line 42"
    );

    expect(updated.status).toBe("failed");
    expect(updated.error).toBe("Compilation timeout on line 42");

    const diskState = await readTaskLedger(TEST_DIR);
    const failedItem = diskState?.tasks.find((t) => t.id === "task-fail");
    expect(failedItem?.error).toBe("Compilation timeout on line 42");
  });

  test("generates markdown summary for human-readable tracking", async () => {
    const state = {
      version: "1.0.0",
      updatedAt: 1700000000000,
      tasks: [
        {
          id: "task-1",
          title: "Setup DB",
          status: "completed" as const,
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
        {
          id: "task-2",
          title: "Run Migrations",
          status: "in_progress" as const,
          dependsOn: ["task-1"],
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
    };

    const markdown = generatePlanMarkdown(state);
    expect(markdown).toContain("# Task Plan Ledger");
    expect(markdown).toContain("[x] **task-1**: Setup DB");
    expect(markdown).toContain("[-] **task-2**: Run Migrations");
  });

  test("refuses mutations when another owner holds the ledger lock", async () => {
    const held = await acquireSwarmLock({ lockName: "task_ledger_mutation", lockDir: TEST_DIR, ownerId: "owner-a", ttlMs: 10000 });
    expect(held.acquired).toBe(true);
    await expect(addTask({ ledgerDir: TEST_DIR, ownerId: "owner-b" }, { id: "blocked", title: "Must not write", status: "pending" })).rejects.toThrow(/locked/i);
    await releaseSwarmLock(held);
  });

  test("persists task ledger with owner-only permissions", async () => {
    await initTaskLedger({ ledgerDir: TEST_DIR, ownerId: "agent-alpha" });
    const info = await stat(join(TEST_DIR, "task-ledger.json"));
    expect(info.mode & 0o777).toBe(0o600);
  });

  test("does not import state through a symlinked ledger file", async () => {
    const outside = join(TEST_DIR, "..", `outside-ledger-${Date.now()}.json`);
    await writeFile(outside, JSON.stringify({ version: "1.0.0", updatedAt: 1, tasks: [{ id: "external-secret", title: "External", status: "pending", createdAt: 1, updatedAt: 1 }] }));
    try {
      await symlink(outside, join(TEST_DIR, "task-ledger.json"));
      const options = { ledgerDir: TEST_DIR, ownerId: "agent-alpha" };
      const added = await addTask(options, { id: "local", title: "Local", status: "pending" });
      expect(added.id).toBe("local");
      const state = await readTaskLedger(TEST_DIR);
      expect(state?.tasks.map((task) => task.id)).toEqual(["local"]);
      expect(JSON.parse(await readFile(outside, "utf8")).tasks[0].id).toBe("external-secret");
    } finally {
      await rm(outside, { force: true });
    }
  });

});
