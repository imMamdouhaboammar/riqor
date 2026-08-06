import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type ActivatorConfig = Readonly<{
  session: string;
  intervalMs: number;
  watchdogMs: number;
}>;

type ActivatorState = {
  version: 1;
  intervalMs: number;
  watchdogMs: number;
  startedAt: number;
  lastActivityAt: number;
  lastActivatedAt: number;
  nextDueAt: number;
  cycle: number;
  phase: "waiting" | "reviewing";
  reviewStartedAt?: number;
  reviewDeadlineAt?: number;
};

export type ActivatorStopResult =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "block" | "completed" | "timeout"; cycle: number }>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keyPattern = /^[a-f0-9]{64}$/;
const minIntervalMs = 60_000;
const maxIntervalMs = 24 * 60 * 60 * 1_000;
const minWatchdogMs = 10_000;
const maxWatchdogMs = 30 * 60 * 1_000;
const maxStateBytes = 1_024;
const staleStateMs = 24 * 60 * 60 * 1_000;
const staleLockMs = 60_000;
const lockAttempts = 40;
const lockRetryMs = 5;

function boundedInteger(value: string | undefined, minimum: number, maximum: number) {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) return undefined;
  return number;
}

export function readActivatorConfig(environment: Record<string, string | undefined>): ActivatorConfig | undefined {
  if (environment.RIQOR_ACTIVATOR_ENABLED !== "1") return undefined;
  const session = environment.RIQOR_ACTIVATOR_SESSION;
  const intervalMs = boundedInteger(environment.RIQOR_ACTIVATOR_INTERVAL_MS, minIntervalMs, maxIntervalMs);
  const watchdogMs = boundedInteger(environment.RIQOR_ACTIVATOR_WATCHDOG_MS, minWatchdogMs, maxWatchdogMs);
  if (!session || !uuidPattern.test(session) || intervalMs === undefined || watchdogMs === undefined) return undefined;
  return { session, intervalMs, watchdogMs };
}

function activatorKey(config: ActivatorConfig) {
  return createHash("sha256").update(config.session).digest("hex");
}

function activatorDirectory(dataDir: string) {
  return join(dataDir, "activator");
}

function statePath(dataDir: string, key: string) {
  if (!keyPattern.test(key)) throw new Error("invalid activator key");
  return join(activatorDirectory(dataDir), `${key}.json`);
}

function lockPath(dataDir: string, key: string) {
  if (!keyPattern.test(key)) throw new Error("invalid activator key");
  return join(activatorDirectory(dataDir), `.${key}.lock`);
}

async function secureDirectory(dataDir: string) {
  const directory = activatorDirectory(dataDir);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("activator state path must be a real directory");
  await chmod(directory, 0o700);
  return directory;
}

function validTime(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseState(contents: string, config: ActivatorConfig): ActivatorState | undefined {
  try {
    const value = JSON.parse(contents) as Partial<ActivatorState>;
    if (value.version !== 1) return undefined;
    if (value.intervalMs !== config.intervalMs || value.watchdogMs !== config.watchdogMs) return undefined;
    if (!validTime(value.startedAt) || !validTime(value.lastActivityAt) || !validTime(value.lastActivatedAt)) return undefined;
    if (!validTime(value.nextDueAt) || !Number.isSafeInteger(value.cycle) || Number(value.cycle) < 0) return undefined;
    if (value.phase !== "waiting" && value.phase !== "reviewing") return undefined;
    if (value.phase === "reviewing") {
      if (!validTime(value.reviewStartedAt) || !validTime(value.reviewDeadlineAt)) return undefined;
    }
    return value as ActivatorState;
  } catch {
    return undefined;
  }
}

async function readState(dataDir: string, config: ActivatorConfig) {
  const path = statePath(dataDir, activatorKey(config));
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > maxStateBytes) {
      await rm(path, { force: true });
      return undefined;
    }
    const value = parseState(await readFile(path, "utf8"), config);
    if (!value) await rm(path, { force: true });
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function writeState(dataDir: string, config: ActivatorConfig, state: ActivatorState) {
  const directory = await secureDirectory(dataDir);
  const key = activatorKey(config);
  const target = statePath(dataDir, key);
  const temporary = join(directory, `.${key}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(state)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, target);
    await chmod(target, 0o600);
  } finally {
    await rm(temporary, { force: true });
  }
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function acquireLock(dataDir: string, key: string) {
  await secureDirectory(dataDir);
  const path = lockPath(dataDir, key);
  for (let attempt = 0; attempt < lockAttempts; attempt += 1) {
    try {
      await mkdir(path, { mode: 0o700 });
      await writeFile(join(path, "owner.json"), `${JSON.stringify({ version: 1, pid: process.pid, createdAt: Date.now() })}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      return path;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const info = await lstat(path);
        if (!info.isDirectory() || info.isSymbolicLink() || Date.now() - info.mtimeMs > staleLockMs) {
          await rm(path, { recursive: true, force: true });
          continue;
        }
      } catch (readError) {
        if ((readError as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw readError;
      }
      await delay(lockRetryMs);
    }
  }
  throw new Error("timed out acquiring activator state lock");
}

async function withLock<T>(dataDir: string, config: ActivatorConfig, operation: () => Promise<T>) {
  const key = activatorKey(config);
  const path = await acquireLock(dataDir, key);
  try {
    return await operation();
  } finally {
    await rm(path, { recursive: true, force: true });
  }
}

function initialState(config: ActivatorConfig, now: number): ActivatorState {
  return {
    version: 1,
    intervalMs: config.intervalMs,
    watchdogMs: config.watchdogMs,
    startedAt: now,
    lastActivityAt: now,
    lastActivatedAt: now,
    nextDueAt: now + config.intervalMs,
    cycle: 0,
    phase: "waiting",
  };
}

async function pruneActivatorState(dataDir: string, now = Date.now()) {
  const directory = await secureDirectory(dataDir);
  for (const name of await readdir(directory)) {
    if (!keyPattern.test(name.replace(/\.json$/, "")) || !name.endsWith(".json")) continue;
    const path = join(directory, name);
    try {
      const info = await stat(path);
      if (now - info.mtimeMs > staleStateMs) await rm(path, { force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export async function initializeActivator(dataDir: string, config: ActivatorConfig, now = Date.now()) {
  await pruneActivatorState(dataDir, now);
  await withLock(dataDir, config, () => writeState(dataDir, config, initialState(config, now)));
}

export async function touchActivator(dataDir: string, config: ActivatorConfig, now = Date.now()) {
  await withLock(dataDir, config, async () => {
    const current = await readState(dataDir, config);
    const state = current ?? initialState(config, now);
    await writeState(dataDir, config, { ...state, lastActivityAt: now });
  });
}

export async function observeActivatorStop(
  dataDir: string,
  config: ActivatorConfig,
  now = Date.now(),
  allowStart = true,
): Promise<ActivatorStopResult> {
  return withLock(dataDir, config, async () => {
    const current = await readState(dataDir, config);
    if (!current) {
      await writeState(dataDir, config, initialState(config, now));
      return { kind: "none" };
    }

    if (current.phase === "reviewing") {
      const timedOut = now > (current.reviewDeadlineAt ?? 0);
      await writeState(dataDir, config, {
        ...current,
        phase: "waiting",
        lastActivityAt: now,
        lastActivatedAt: now,
        nextDueAt: now + config.intervalMs,
        reviewStartedAt: undefined,
        reviewDeadlineAt: undefined,
      });
      return { kind: timedOut ? "timeout" : "completed", cycle: current.cycle };
    }

    if (!allowStart || now < current.nextDueAt) return { kind: "none" };
    const cycle = current.cycle + 1;
    await writeState(dataDir, config, {
      ...current,
      phase: "reviewing",
      cycle,
      lastActivityAt: now,
      reviewStartedAt: now,
      reviewDeadlineAt: now + config.watchdogMs,
    });
    return { kind: "block", cycle };
  });
}

export async function clearActivator(dataDir: string, config: ActivatorConfig) {
  await withLock(dataDir, config, () => rm(statePath(dataDir, activatorKey(config)), { force: true }));
}
