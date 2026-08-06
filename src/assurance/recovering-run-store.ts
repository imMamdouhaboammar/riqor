import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  appendRunEvent as appendBaseRunEvent,
  completeRun as completeBaseRun,
  createRun,
  readActiveRun as readBaseActiveRun,
  readRun as readBaseRun,
  readRunEvents,
  transitionRun as transitionBaseRun,
  type AppendRunEventOptions,
  type CompleteRunOptions,
  type CreateRunOptions,
  type RunLocation,
  type TransitionRunOptions,
} from "./run-store";
import type { RiqorRun, RiqorRunStatus, RiqorTraceEvent } from "./types";

const defaultLockTimeoutMs = 1_000;
const defaultStaleLockMs = 30_000;
const lockRetryMs = 20;

type LockOptions = Readonly<{
  timeoutMs?: number;
  staleMs?: number;
}>;

function projectDirectory(stateRoot: string, rootDigest: string) {
  return join(stateRoot, "projects", rootDigest);
}

function runDirectory(options: RunLocation) {
  return join(
    projectDirectory(options.stateRoot, options.identity.rootDigest),
    "runs",
    options.runId,
  );
}

function activePath(options: Omit<RunLocation, "runId">) {
  return join(projectDirectory(options.stateRoot, options.identity.rootDigest), "active.json");
}

async function existingFileKind(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function assertSafeRegularFile(path: string, allowMissing = false) {
  const entry = await existingFileKind(path);
  if (!entry) {
    if (allowMissing) return false;
    throw new Error("state file not found");
  }
  if (entry.isSymbolicLink()) throw new Error("unsafe symlink state path");
  if (!entry.isFile()) throw new Error("unsafe non-file state path");
  return true;
}

async function writeJsonAtomic(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await assertSafeRegularFile(path, true);
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function withFileLock<T>(
  lockPath: string,
  action: () => Promise<T>,
  options: LockOptions = {},
) {
  const timeoutMs = options.timeoutMs ?? defaultLockTimeoutMs;
  const staleMs = options.staleMs ?? defaultStaleLockMs;
  const startedAt = Date.now();
  await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 });

  for (;;) {
    let handle;
    try {
      handle = await open(lockPath, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const entry = await existingFileKind(lockPath);
      if (!entry) continue;
      if (entry.isSymbolicLink()) throw new Error("unsafe symlink state path");
      if (!entry.isFile()) throw new Error("unsafe non-file state path");
      if (Date.now() - entry.mtimeMs > staleMs) {
        await rm(lockPath, { force: true });
        continue;
      }
      if (Date.now() - startedAt >= timeoutMs) throw new Error("run state is busy");
      await sleep(lockRetryMs);
      continue;
    }

    try {
      await handle.writeFile(`${JSON.stringify({
        pid: process.pid,
        createdAt: new Date().toISOString(),
        purpose: "trace-recovery",
      })}\n`);
      return await action();
    } finally {
      await handle.close();
      await rm(lockPath, { force: true });
    }
  }
}

function deriveRunState(run: RiqorRun, events: readonly RiqorTraceEvent[]) {
  let status: RiqorRunStatus = run.status;
  let completedAt = run.completedAt;

  for (const event of events) {
    const successfulMutation = event.type === "command_completed"
      && event.status === "success"
      && event.metadata?.kind === "mutation";

    if (
      successfulMutation
      || event.type === "workspace_mutated"
      || event.type === "verification_required"
    ) {
      status = "verification-pending";
      completedAt = undefined;
    } else if (event.type === "verification_completed") {
      status = "active";
      completedAt = undefined;
    } else if (event.type === "run_completed") {
      status = "completed";
      completedAt = event.timestamp;
    }
  }

  return { status, completedAt } as const;
}

async function reconcileRunStateLocked(options: RunLocation) {
  const run = await readBaseRun(options);
  const events = await readRunEvents(options);
  const expectedNextSequence = events.length + 1;

  if (run.nextSequence > expectedNextSequence) {
    throw new Error("run state is ahead of trace");
  }
  if (run.nextSequence === expectedNextSequence) return run;

  const lastEvent = events.at(-1);
  if (!lastEvent) throw new Error("run trace is missing");
  const derived = deriveRunState(run, events);
  const updated: RiqorRun = Object.freeze({
    ...run,
    status: derived.status,
    nextSequence: expectedNextSequence,
    updatedAt: lastEvent.timestamp,
    ...(derived.completedAt === undefined
      ? { completedAt: undefined }
      : { completedAt: derived.completedAt }),
  });
  await writeJsonAtomic(join(runDirectory(options), "run.json"), updated);
  return updated;
}

async function reconcileRunState(options: RunLocation, lockOptions: LockOptions = {}) {
  return withFileLock(
    join(runDirectory(options), ".lock"),
    () => reconcileRunStateLocked(options),
    lockOptions,
  );
}

async function clearTerminalActivePointer(
  options: Omit<RunLocation, "runId">,
  run: RiqorRun,
) {
  if (!["completed", "failed", "abandoned"].includes(run.status)) return;
  const path = activePath(options);
  if (!await assertSafeRegularFile(path, true)) return;
  const pointer = JSON.parse(await readFile(path, "utf8")) as {
    schemaVersion?: number;
    runId?: string;
  };
  if (pointer.schemaVersion === 1 && pointer.runId === run.runId) {
    await rm(path, { force: true });
  }
}

export { createRun };
export type {
  AppendRunEventOptions,
  CompleteRunOptions,
  CreateRunOptions,
  RunLocation,
  TransitionRunOptions,
};

export async function readRun(options: RunLocation) {
  return reconcileRunState(options);
}

export async function readActiveRun(options: Omit<RunLocation, "runId">) {
  const active = await readBaseActiveRun(options);
  if (!active) return null;
  const recovered = await reconcileRunState({ ...options, runId: active.runId });
  await clearTerminalActivePointer(options, recovered);
  return ["completed", "failed", "abandoned"].includes(recovered.status)
    ? null
    : recovered;
}

export async function appendRunEvent(options: AppendRunEventOptions) {
  await reconcileRunState(options, {
    timeoutMs: options.lockTimeoutMs,
    staleMs: options.staleLockMs,
  });
  return appendBaseRunEvent(options);
}

export async function transitionRun(options: TransitionRunOptions) {
  await reconcileRunState(options, {
    timeoutMs: options.lockTimeoutMs,
    staleMs: options.staleLockMs,
  });
  return transitionBaseRun(options);
}

export async function completeRun(options: CompleteRunOptions) {
  await reconcileRunState(options, {
    timeoutMs: options.lockTimeoutMs,
    staleMs: options.staleLockMs,
  });
  return completeBaseRun(options);
}

export async function readRecoveredRunEvents(options: RunLocation) {
  await reconcileRunState(options);
  return readRunEvents(options);
}
