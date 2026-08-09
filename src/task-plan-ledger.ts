import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { acquireSwarmLock, releaseSwarmLock } from "./assurance/swarm-lock.js";

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "blocked";

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  dependsOn?: string[];
  ownerId?: string;
  targetFiles?: string[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
}

export interface TaskPlanLedgerOptions {
  ledgerDir: string;
  ownerId: string;
}

export interface PlanLedgerState {
  version: string;
  updatedAt: number;
  tasks: TaskItem[];
}

const LEDGER_FILE_NAME = "task-ledger.json";
const LEDGER_VERSION = "1.0.0";
const LOCK_NAME = "task_ledger_mutation";

function requireLedgerLock(lock: Awaited<ReturnType<typeof acquireSwarmLock>>): void {
  if (!lock.acquired) {
    throw new Error(`task ledger is locked by ${lock.ownerId}`);
  }
}

function getLedgerFilePath(ledgerDir: string): string {
  return join(ledgerDir, LEDGER_FILE_NAME);
}

async function writeTaskLedger(ledgerDir: string, state: PlanLedgerState): Promise<void> {
  const filePath = getLedgerFilePath(ledgerDir);
  const temporary = join(ledgerDir, `.task-ledger-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, filePath);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function readTaskLedger(ledgerDir: string): Promise<PlanLedgerState | null> {
  try {
    const filePath = getLedgerFilePath(ledgerDir);
    const info = await lstat(filePath);
    if (!info.isFile() || info.isSymbolicLink()) return null;
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as PlanLedgerState;
  } catch {
    return null;
  }
}

export async function initTaskLedger(
  options: TaskPlanLedgerOptions,
  initialTasks: TaskItem[] = []
): Promise<PlanLedgerState> {
  const { ledgerDir, ownerId } = options;
  await mkdir(ledgerDir, { recursive: true, mode: 0o700 });

  const lock = await acquireSwarmLock({
    lockName: LOCK_NAME,
    lockDir: ledgerDir,
    ownerId,
  });
  requireLedgerLock(lock);

  try {
    const now = Date.now();
    const existing = await readTaskLedger(ledgerDir);

    if (existing) {
      return existing;
    }

    const state: PlanLedgerState = {
      version: LEDGER_VERSION,
      updatedAt: now,
      tasks: initialTasks,
    };

    await writeTaskLedger(ledgerDir, state);
    return state;
  } finally {
    if (lock.acquired) {
      await releaseSwarmLock(lock);
    }
  }
}

export async function addTask(
  options: TaskPlanLedgerOptions,
  taskData: Omit<TaskItem, "createdAt" | "updatedAt">
): Promise<TaskItem> {
  const { ledgerDir, ownerId } = options;
  await mkdir(ledgerDir, { recursive: true, mode: 0o700 });

  const lock = await acquireSwarmLock({
    lockName: LOCK_NAME,
    lockDir: ledgerDir,
    ownerId,
  });
  requireLedgerLock(lock);

  try {
    const state = (await readTaskLedger(ledgerDir)) ?? {
      version: LEDGER_VERSION,
      updatedAt: Date.now(),
      tasks: [],
    };

    const now = Date.now();
    const newTask: TaskItem = {
      ...taskData,
      createdAt: now,
      updatedAt: now,
    };

    state.tasks.push(newTask);
    state.updatedAt = now;

    await writeTaskLedger(ledgerDir, state);
    return newTask;
  } finally {
    if (lock.acquired) {
      await releaseSwarmLock(lock);
    }
  }
}

export async function updateTaskStatus(
  options: TaskPlanLedgerOptions,
  taskId: string,
  status: TaskStatus,
  error?: string
): Promise<TaskItem> {
  const { ledgerDir, ownerId } = options;

  const lock = await acquireSwarmLock({
    lockName: LOCK_NAME,
    lockDir: ledgerDir,
    ownerId,
  });
  requireLedgerLock(lock);

  try {
    const state = await readTaskLedger(ledgerDir);
    if (!state) {
      throw new Error(`Ledger not found at ${ledgerDir}`);
    }

    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new Error(`Task with ID '${taskId}' not found`);
    }

    const now = Date.now();
    task.status = status;
    task.updatedAt = now;

    if (status === "completed") {
      task.completedAt = now;
      delete task.error;
    } else if (status === "failed") {
      task.error = error;
    }

    state.updatedAt = now;

    await writeTaskLedger(ledgerDir, state);
    return task;
  } finally {
    if (lock.acquired) {
      await releaseSwarmLock(lock);
    }
  }
}

export async function getNextExecutableTasks(
  options: TaskPlanLedgerOptions
): Promise<TaskItem[]> {
  const state = await readTaskLedger(options.ledgerDir);
  if (!state) return [];

  const completedTaskIds = new Set(
    state.tasks.filter((t) => t.status === "completed").map((t) => t.id)
  );

  return state.tasks.filter((t) => {
    if (t.status !== "pending") return false;
    if (!t.dependsOn || t.dependsOn.length === 0) return true;
    return t.dependsOn.every((depId) => completedTaskIds.has(depId));
  });
}

export function generatePlanMarkdown(state: PlanLedgerState): string {
  const lines: string[] = [];
  lines.push("# Task Plan Ledger");
  lines.push("");
  lines.push(`*Last Updated: ${new Date(state.updatedAt).toISOString()}*`);
  lines.push("");

  for (const task of state.tasks) {
    const checkbox = task.status === "completed" ? "[x]" : task.status === "in_progress" ? "[-]" : "[ ]";
    lines.push(`- ${checkbox} **${task.id}**: ${task.title}`);
    if (task.description) {
      lines.push(`  - Description: ${task.description}`);
    }
    if (task.dependsOn && task.dependsOn.length > 0) {
      lines.push(`  - Depends on: ${task.dependsOn.join(", ")}`);
    }
    if (task.error) {
      lines.push(`  - Error: \`${task.error}\``);
    }
  }

  return lines.join("\n");
}
