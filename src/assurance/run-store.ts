import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { harnessPaths, type HarnessPathId } from "../../plugins/codex-self-improvement/hooks/paths";
import { normalizeRunGoal, type RepositoryIdentity } from "./repository-identity";
import type {
  ExecutionProfileId,
  RiqorRun,
  RiqorRunStatus,
  RiqorTraceEvent,
  RiqorTraceEventStatus,
  RiqorTraceEventType,
  RiqorTraceMetadataValue,
} from "./types";

const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const HEAD_PATTERN = /^[a-f0-9]{40}$/;
const METADATA_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const DEFAULT_LOCK_TIMEOUT_MS = 1_000;
const DEFAULT_STALE_LOCK_MS = 30_000;
const LOCK_RETRY_MS = 20;
const PATH_IDS = new Set(harnessPaths.map(({ id }) => id));
const PROFILES = new Set<ExecutionProfileId>(["standard", "assured"]);
const RUN_STATUSES = new Set<RiqorRunStatus>([
  "active",
  "verification-pending",
  "completed",
  "failed",
  "abandoned",
]);
const EVENT_SOURCES = new Set<RiqorTraceEvent["source"]>(["riqor", "terminal"]);
const EVENT_TYPES = new Set<RiqorTraceEventType>([
  "run_started",
  "command_completed",
  "workspace_mutated",
  "verification_required",
  "verification_completed",
  "run_completed",
]);
const EVENT_STATUSES = new Set<RiqorTraceEventStatus>(["pending", "success", "failure"]);

export type RunLocation = Readonly<{
  stateRoot: string;
  identity: RepositoryIdentity;
  runId: string;
}>;

export type CreateRunOptions = Readonly<{
  stateRoot: string;
  identity: RepositoryIdentity;
  goal: string;
  pathId: HarnessPathId;
  profileId: ExecutionProfileId;
  parentRunId?: string;
  now?: Date;
  randomId?: () => string;
}>;

export type RunEventInput = Readonly<{
  source: RiqorTraceEvent["source"];
  type: RiqorTraceEventType;
  status: RiqorTraceEventStatus;
  subject?: string;
  digest?: string;
  evidenceRefs?: readonly string[];
  metadata?: Readonly<Record<string, RiqorTraceMetadataValue>>;
  nextStatus?: RiqorRunStatus;
  whenStatus?: RiqorRunStatus;
  now?: Date;
  randomId?: () => string;
}>;

export type AppendRunEventsOptions = RunLocation & Readonly<{
  events: readonly RunEventInput[];
  lockTimeoutMs?: number;
  staleLockMs?: number;
}>;

export type AppendRunEventOptions = RunLocation & RunEventInput & Readonly<{
  lockTimeoutMs?: number;
  staleLockMs?: number;
}>;

export type TransitionRunOptions = RunLocation & Readonly<{
  status: RiqorRunStatus;
  now?: Date;
  lockTimeoutMs?: number;
  staleLockMs?: number;
}>;

export type CompleteRunOptions = RunLocation & Readonly<{
  now?: Date;
  randomId?: () => string;
  lockTimeoutMs?: number;
  staleLockMs?: number;
}>;

type ActivePointer = Readonly<{
  schemaVersion: 1;
  runId: string;
}>;

type LockOptions = Readonly<{
  timeoutMs?: number;
  staleMs?: number;
}>;

function projectDirectory(stateRoot: string, rootDigest: string) {
  return join(stateRoot, "projects", rootDigest);
}

function runsDirectory(stateRoot: string, rootDigest: string) {
  return join(projectDirectory(stateRoot, rootDigest), "runs");
}

function runDirectory(stateRoot: string, rootDigest: string, runId: string) {
  return join(runsDirectory(stateRoot, rootDigest), runId);
}

function activePath(stateRoot: string, rootDigest: string) {
  return join(projectDirectory(stateRoot, rootDigest), "active.json");
}

function validateRootDigest(value: string) {
  if (!DIGEST_PATTERN.test(value)) throw new Error("invalid repository digest");
}

function validateRunId(value: string) {
  if (!RUN_ID_PATTERN.test(value)) throw new Error("invalid run id");
}

function validateTimestamp(value: unknown, label: string) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`invalid ${label}`);
  }
}

function boundedText(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string") throw new Error(`invalid ${label}`);
  if (Array.from(value).length > maximum) throw new Error(`${label} is too long`);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) {
    throw new Error(`${label} contains unsupported control characters`);
  }
  return value;
}

function validateEventFields(event: Partial<RiqorTraceEvent>) {
  if (!EVENT_SOURCES.has(event.source as RiqorTraceEvent["source"])) {
    throw new Error("invalid trace event source");
  }
  if (!EVENT_TYPES.has(event.type as RiqorTraceEventType)) {
    throw new Error("invalid trace event type");
  }
  if (!EVENT_STATUSES.has(event.status as RiqorTraceEventStatus)) {
    throw new Error("invalid trace event status");
  }
  if (typeof event.eventId !== "string" || !RUN_ID_PATTERN.test(event.eventId)) {
    throw new Error("invalid trace event id");
  }
  validateTimestamp(event.timestamp, "trace event timestamp");
  if (event.subject !== undefined) boundedText(event.subject, "trace event subject", 256);
  if (event.digest !== undefined) {
    if (typeof event.digest !== "string" || !DIGEST_PATTERN.test(event.digest)) {
      throw new Error("invalid event digest");
    }
  }
  if (event.evidenceRefs !== undefined && !Array.isArray(event.evidenceRefs)) {
    throw new Error("invalid evidence references");
  }
  if ((event.evidenceRefs?.length ?? 0) > 32) {
    throw new Error("too many evidence references");
  }
  for (const reference of event.evidenceRefs ?? []) {
    boundedText(reference, "evidence reference", 128);
  }
  if (event.metadata !== undefined && (
    !event.metadata
    || typeof event.metadata !== "object"
    || Array.isArray(event.metadata)
  )) {
    throw new Error("invalid event metadata");
  }
  const metadataEntries = Object.entries(event.metadata ?? {});
  if (metadataEntries.length > 32) throw new Error("too many event metadata entries");
  for (const [key, value] of metadataEntries) {
    if (!METADATA_KEY_PATTERN.test(key)) throw new Error("invalid event metadata key");
    if (typeof value === "string") boundedText(value, "event metadata value", 512);
    else if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("invalid event metadata number");
    } else if (value !== null && !["number", "boolean"].includes(typeof value)) {
      throw new Error("invalid event metadata value");
    }
  }
}

function validateEventInput(options: RunEventInput) {
  validateEventFields({
    eventId: "event-placeholder",
    source: options.source,
    type: options.type,
    status: options.status,
    timestamp: (options.now ?? new Date()).toISOString(),
    subject: options.subject,
    digest: options.digest,
    evidenceRefs: options.evidenceRefs,
    metadata: options.metadata,
  });
  if (options.nextStatus !== undefined && !RUN_STATUSES.has(options.nextStatus)) {
    throw new Error("invalid run status transition");
  }
  if (options.whenStatus !== undefined && !RUN_STATUSES.has(options.whenStatus)) {
    throw new Error("invalid run status condition");
  }
}

function publicRepository(identity: RepositoryIdentity): RiqorRun["repository"] {
  validateRootDigest(identity.rootDigest);
  if (identity.headSha !== null && !HEAD_PATTERN.test(identity.headSha)) {
    throw new Error("invalid repository head");
  }
  return Object.freeze({
    rootDigest: identity.rootDigest,
    headSha: identity.headSha,
    dirty: identity.dirty,
  });
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

async function readTextFile(path: string) {
  await assertSafeRegularFile(path);
  return readFile(path, "utf8");
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

async function appendLine(path: string, line: string) {
  await assertSafeRegularFile(path, true);
  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  let handle;
  try {
    handle = await open(
      path,
      constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY | noFollow,
      0o600,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      throw new Error("unsafe symlink state path");
    }
    throw error;
  }
  try {
    await handle.writeFile(line, "utf8");
  } finally {
    await handle.close();
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
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  const staleMs = options.staleMs ?? DEFAULT_STALE_LOCK_MS;
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
      await sleep(LOCK_RETRY_MS);
      continue;
    }

    try {
      await handle.writeFile(`${JSON.stringify({
        pid: process.pid,
        createdAt: new Date().toISOString(),
      })}\n`);
      return await action();
    } finally {
      await handle.close();
      await rm(lockPath, { force: true });
    }
  }
}

function parseJson(text: string, label: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`invalid ${label} JSON`);
  }
}

function validateRun(
  value: unknown,
  identity: RepositoryIdentity,
  expectedRunId: string,
): RiqorRun {
  if (!value || typeof value !== "object") throw new Error("invalid run record");
  const run = value as Partial<RiqorRun>;
  if (run.schemaVersion !== 1) throw new Error("unsupported run schema");
  if (run.runId !== expectedRunId || run.repository?.rootDigest !== identity.rootDigest) {
    throw new Error("run repository identity mismatch");
  }
  if (!RUN_ID_PATTERN.test(run.runId) || !RUN_ID_PATTERN.test(run.runGroupId ?? "")) {
    throw new Error("invalid run record");
  }
  if (run.parentRunId !== undefined && !RUN_ID_PATTERN.test(run.parentRunId)) {
    throw new Error("invalid run record");
  }
  if (typeof run.goal !== "string" || normalizeRunGoal(run.goal) !== run.goal) {
    throw new Error("invalid run record");
  }
  if (!PATH_IDS.has(run.pathId as HarnessPathId)) throw new Error("invalid run record");
  if (!PROFILES.has(run.profileId as ExecutionProfileId)) throw new Error("invalid run record");
  if (!RUN_STATUSES.has(run.status as RiqorRunStatus)) throw new Error("invalid run record");
  if (!run.repository || typeof run.repository.dirty !== "boolean") {
    throw new Error("invalid run record");
  }
  if (run.repository.headSha !== null && !HEAD_PATTERN.test(run.repository.headSha ?? "")) {
    throw new Error("invalid run record");
  }
  validateTimestamp(run.createdAt, "run timestamp");
  validateTimestamp(run.updatedAt, "run timestamp");
  if (run.completedAt !== undefined) validateTimestamp(run.completedAt, "run timestamp");
  if (!Number.isInteger(run.nextSequence) || (run.nextSequence ?? 0) < 1) {
    throw new Error("invalid run record");
  }
  return Object.freeze(run as RiqorRun);
}

function validateActivePointer(value: unknown): ActivePointer {
  if (!value || typeof value !== "object") throw new Error("invalid active run pointer");
  const pointer = value as Partial<ActivePointer>;
  if (pointer.schemaVersion !== 1) throw new Error("unsupported active run schema");
  if (typeof pointer.runId !== "string" || !RUN_ID_PATTERN.test(pointer.runId)) {
    throw new Error("invalid active run pointer");
  }
  return Object.freeze(pointer as ActivePointer);
}

function validateTraceEvent(value: unknown, run: RiqorRun): RiqorTraceEvent {
  if (!value || typeof value !== "object") throw new Error("invalid trace event");
  const event = value as Partial<RiqorTraceEvent>;
  if (event.schemaVersion !== 1) throw new Error("unsupported trace event schema");
  if (event.runId !== run.runId || event.runGroupId !== run.runGroupId) {
    throw new Error("trace event run mismatch");
  }
  if (!Number.isInteger(event.sequence) || (event.sequence ?? 0) < 1) {
    throw new Error("invalid trace event sequence");
  }
  validateEventFields(event);
  return Object.freeze(event as RiqorTraceEvent);
}

async function readValidatedEvents(options: RunLocation, run: RiqorRun) {
  const path = join(
    runDirectory(options.stateRoot, options.identity.rootDigest, options.runId),
    "events.jsonl",
  );
  if (!await assertSafeRegularFile(path, true)) return [];
  const lines = (await readFile(path, "utf8")).split("\n").filter(Boolean);
  const events = lines.map((line) => validateTraceEvent(parseJson(line, "trace event"), run));
  for (let index = 0; index < events.length; index += 1) {
    if (events[index]!.sequence !== index + 1) throw new Error("trace event sequence gap");
  }
  return events;
}

function deriveRunState(run: RiqorRun, events: readonly RiqorTraceEvent[]) {
  let status = run.status;
  let completedAt = run.completedAt;
  for (const event of events) {
    const successfulMutation = event.type === "command_completed"
      && event.status === "success"
      && event.metadata?.kind === "mutation";
    if (successfulMutation || event.type === "workspace_mutated" || event.type === "verification_required") {
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

async function reconcileRunState(options: RunLocation, run: RiqorRun) {
  const events = await readValidatedEvents(options, run);
  const expectedNextSequence = events.length + 1;
  if (run.nextSequence > expectedNextSequence) throw new Error("run state is ahead of trace");
  if (run.nextSequence === expectedNextSequence) return run;

  const lastEvent = events.at(-1);
  if (!lastEvent) throw new Error("run trace is missing");
  const derived = deriveRunState(run, events);
  const updated: RiqorRun = Object.freeze({
    ...run,
    status: derived.status,
    nextSequence: expectedNextSequence,
    updatedAt: lastEvent.timestamp,
    ...(derived.completedAt === undefined ? { completedAt: undefined } : { completedAt: derived.completedAt }),
  });
  await writeJsonAtomic(
    join(runDirectory(options.stateRoot, options.identity.rootDigest, options.runId), "run.json"),
    updated,
  );
  return updated;
}

async function readRunFile(options: RunLocation) {
  validateRootDigest(options.identity.rootDigest);
  validateRunId(options.runId);
  const path = join(
    runDirectory(options.stateRoot, options.identity.rootDigest, options.runId),
    "run.json",
  );
  try {
    return validateRun(
      parseJson(await readTextFile(path), "run"),
      options.identity,
      options.runId,
    );
  } catch (error) {
    if ((error as Error).message === "state file not found") throw new Error("run not found");
    throw error;
  }
}

function buildEvent(input: RunEventInput, run: RiqorRun): RiqorTraceEvent {
  validateEventInput(input);
  const timestamp = (input.now ?? new Date()).toISOString();
  const event: RiqorTraceEvent = Object.freeze({
    schemaVersion: 1,
    eventId: (input.randomId ?? randomUUID)(),
    sequence: run.nextSequence,
    runId: run.runId,
    runGroupId: run.runGroupId,
    source: input.source,
    type: input.type,
    status: input.status,
    timestamp,
    ...(input.subject === undefined ? {} : { subject: input.subject }),
    ...(input.digest === undefined ? {} : { digest: input.digest }),
    ...(input.evidenceRefs === undefined ? {} : { evidenceRefs: [...input.evidenceRefs] }),
    ...(input.metadata === undefined ? {} : { metadata: { ...input.metadata } }),
  });
  validateEventFields(event);
  return event;
}

async function appendEventsLocked(
  options: AppendRunEventsOptions,
  run: RiqorRun,
): Promise<{ events: RiqorTraceEvent[]; run: RiqorRun }> {
  if (options.events.length === 0) throw new Error("at least one run event is required");
  if (options.events.length > 16) throw new Error("too many run events in one batch");

  const events: RiqorTraceEvent[] = [];
  let updated = run;
  for (const input of options.events) {
    validateEventInput(input);
    if (input.whenStatus !== undefined && updated.status !== input.whenStatus) continue;
    const event = buildEvent(input, updated);
    events.push(event);
    updated = Object.freeze({
      ...updated,
      status: input.nextStatus ?? updated.status,
      nextSequence: event.sequence + 1,
      updatedAt: event.timestamp,
    });
  }

  if (events.length === 0) return { events, run: updated };
  const directory = runDirectory(options.stateRoot, options.identity.rootDigest, options.runId);
  await appendLine(
    join(directory, "events.jsonl"),
    events.map((event) => `${JSON.stringify(event)}\n`).join(""),
  );
  await writeJsonAtomic(join(directory, "run.json"), updated);
  return { events, run: updated };
}

export async function readRun(options: RunLocation) {
  validateRunId(options.runId);
  const directory = runDirectory(options.stateRoot, options.identity.rootDigest, options.runId);
  return withFileLock(join(directory, ".lock"), async () => {
    const run = await readRunFile(options);
    return reconcileRunState(options, run);
  });
}

export async function readActiveRun(
  options: Omit<RunLocation, "runId">,
): Promise<RiqorRun | null> {
  validateRootDigest(options.identity.rootDigest);
  const path = activePath(options.stateRoot, options.identity.rootDigest);
  if (!await assertSafeRegularFile(path, true)) return null;
  const pointer = validateActivePointer(parseJson(await readTextFile(path), "active run pointer"));
  const run = await readRun({ ...options, runId: pointer.runId });
  if (["completed", "failed", "abandoned"].includes(run.status)) {
    await rm(path, { force: true });
    return null;
  }
  return run;
}

export async function createRun(options: CreateRunOptions): Promise<RiqorRun> {
  validateRootDigest(options.identity.rootDigest);
  const goal = normalizeRunGoal(options.goal);
  const project = projectDirectory(options.stateRoot, options.identity.rootDigest);
  await mkdir(runsDirectory(options.stateRoot, options.identity.rootDigest), {
    recursive: true,
    mode: 0o700,
  });

  return withFileLock(join(project, ".active.lock"), async () => {
    const active = await readActiveRun({
      stateRoot: options.stateRoot,
      identity: options.identity,
    });
    if (active) throw new Error(`an active run already exists: ${active.runId}`);

    const runId = (options.randomId ?? randomUUID)();
    validateRunId(runId);
    const parent = options.parentRunId
      ? await readRunFile({
          stateRoot: options.stateRoot,
          identity: options.identity,
          runId: options.parentRunId,
        })
      : null;
    const runGroupId = parent?.runGroupId ?? runId;
    const timestamp = (options.now ?? new Date()).toISOString();
    const directory = runDirectory(options.stateRoot, options.identity.rootDigest, runId);
    let created = false;
    try {
      try {
        await mkdir(directory, { mode: 0o700 });
        created = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          throw new Error(`run already exists: ${runId}`);
        }
        throw error;
      }

      const initial: RiqorRun = Object.freeze({
        schemaVersion: 1,
        runId,
        runGroupId,
        ...(options.parentRunId === undefined ? {} : { parentRunId: options.parentRunId }),
        goal,
        pathId: options.pathId,
        profileId: options.profileId,
        status: "active",
        repository: publicRepository(options.identity),
        nextSequence: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await writeJsonAtomic(join(directory, "run.json"), initial);
      await appendRunEvent({
        stateRoot: options.stateRoot,
        identity: options.identity,
        runId,
        source: "riqor",
        type: "run_started",
        status: "success",
        subject: options.pathId,
        metadata: { profile: options.profileId },
        now: options.now,
      });
      await writeJsonAtomic(activePath(options.stateRoot, options.identity.rootDigest), {
        schemaVersion: 1,
        runId,
      } satisfies ActivePointer);
      return readRunFile({ stateRoot: options.stateRoot, identity: options.identity, runId });
    } catch (error) {
      if (created) await rm(directory, { recursive: true, force: true });
      throw error;
    }
  });
}

export async function appendRunEvents(options: AppendRunEventsOptions) {
  validateRunId(options.runId);
  const directory = runDirectory(options.stateRoot, options.identity.rootDigest, options.runId);
  return withFileLock(
    join(directory, ".lock"),
    async () => {
      const run = await reconcileRunState(options, await readRunFile(options));
      if (["completed", "failed", "abandoned"].includes(run.status)) {
        throw new Error(`run is not writable: ${run.status}`);
      }
      return appendEventsLocked(options, run);
    },
    { timeoutMs: options.lockTimeoutMs, staleMs: options.staleLockMs },
  );
}

export async function appendRunEvent(options: AppendRunEventOptions) {
  const {
    stateRoot,
    identity,
    runId,
    lockTimeoutMs,
    staleLockMs,
    ...event
  } = options;
  const result = await appendRunEvents({
    stateRoot,
    identity,
    runId,
    events: [event],
    lockTimeoutMs,
    staleLockMs,
  });
  const appended = result.events[0];
  if (!appended) throw new Error("run event condition was not met");
  return appended;
}

export async function transitionRun(options: TransitionRunOptions) {
  validateRunId(options.runId);
  if (!RUN_STATUSES.has(options.status)) throw new Error("invalid run status transition");
  const directory = runDirectory(options.stateRoot, options.identity.rootDigest, options.runId);
  return withFileLock(
    join(directory, ".lock"),
    async () => {
      const run = await reconcileRunState(options, await readRunFile(options));
      const updated: RiqorRun = Object.freeze({
        ...run,
        status: options.status,
        updatedAt: (options.now ?? new Date()).toISOString(),
      });
      await writeJsonAtomic(join(directory, "run.json"), updated);
      return updated;
    },
    { timeoutMs: options.lockTimeoutMs, staleMs: options.staleLockMs },
  );
}

export async function readRunEvents(options: RunLocation) {
  const run = await readRun(options);
  return readValidatedEvents(options, run);
}

async function clearActivePointer(options: RunLocation) {
  const project = projectDirectory(options.stateRoot, options.identity.rootDigest);
  await withFileLock(join(project, ".active.lock"), async () => {
    const path = activePath(options.stateRoot, options.identity.rootDigest);
    if (!await assertSafeRegularFile(path, true)) return;
    const pointer = validateActivePointer(parseJson(await readTextFile(path), "active run pointer"));
    if (pointer.runId === options.runId) await rm(path, { force: true });
  });
}

export async function completeRun(options: CompleteRunOptions) {
  validateRunId(options.runId);
  const directory = runDirectory(options.stateRoot, options.identity.rootDigest, options.runId);
  const completed = await withFileLock(
    join(directory, ".lock"),
    async () => {
      const run = await reconcileRunState(options, await readRunFile(options));
      if (run.status === "verification-pending") {
        throw new Error("verification is still pending");
      }
      if (run.status !== "active") throw new Error(`run is not active: ${run.status}`);
      const now = options.now ?? new Date();
      const result = await appendEventsLocked({
        stateRoot: options.stateRoot,
        identity: options.identity,
        runId: options.runId,
        events: [{
          source: "riqor",
          type: "run_completed",
          status: "success",
          nextStatus: "completed",
          now,
          randomId: options.randomId,
        }],
      }, run);
      const finalRun: RiqorRun = Object.freeze({
        ...result.run,
        completedAt: now.toISOString(),
      });
      await writeJsonAtomic(join(directory, "run.json"), finalRun);
      return finalRun;
    },
    { timeoutMs: options.lockTimeoutMs, staleMs: options.staleLockMs },
  );
  await clearActivePointer(options);
  return completed;
}
