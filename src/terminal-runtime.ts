import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { classifyPrompt, type TaskProfile } from "../plugins/riqor/hooks/router";
import { hasNonExecutingVerificationMode, isPackageVerificationCommand } from "../plugins/riqor/hooks/verification-command";

export type TerminalCommandKind = "mutation" | "verification" | "agent" | "other";

type PendingCommand = Readonly<{
  kind: TerminalCommandKind;
  route: TaskProfile;
  commandDigest: string;
  startedAt: number;
}>;

type StoredTerminalState = Readonly<{
  version: 1;
  sessionDigest: string;
  evidencePending: boolean;
  commandDigest: string;
  lastKind: TerminalCommandKind;
  lastExitCode: number | null;
  route: TaskProfile;
  updatedAt: number;
  pending?: PendingCommand;
}>;

export type TerminalState = Omit<StoredTerminalState, "pending">;

export type TerminalPreexecTransition = Readonly<{
  kind: TerminalCommandKind;
  route: TaskProfile;
  commandDigest: string;
  startedAt: number;
}>;

export type TerminalPostexecTransition = Readonly<{
  kind: TerminalCommandKind;
  route: TaskProfile;
  commandDigest: string;
  exitCode: number;
  startedAt: number;
  completedAt: number;
}>;

export type TerminalPostexecResult = TerminalState & Readonly<{
  transition?: TerminalPostexecTransition;
}>;

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const verification = /^(?:pytest|python\s+-m\s+pytest|cargo\s+test|go\s+test|dotnet\s+test|mvn\b.*\btest\b|gradle\S*\s+test|swift\s+test|xcodebuild\b.*\btest\b|git\s+diff\s+--check|codex\s+doctor|kaku\s+doctor)(?:\s|$)/i;
const mutation = /(?:^|[;&|]\s*)(?:rm|mv|cp|touch|mkdir|install)\b|\b(?:sed\s+-i|perl\s+-pi|git\s+(?:checkout|restore|reset|clean|apply)|npm\s+install|pnpm\s+(?:add|install)|yarn\s+add)\b|(?:^|\s)(?:cat|printf|echo)\b[^\n]*(?:>>?|\|\s*tee\b)|\bapply_patch\b/i;
const agent = /^(?:env\s+[^ ]+\s+)*(?:codex|claude|gemini|agy|aider|pi|delegate-team|vertex-coder|hunk)(?:\s|$)/i;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const COMMAND_KINDS = new Set<TerminalCommandKind>(["mutation", "verification", "agent", "other"]);
const TASK_PROFILES = new Set<TaskProfile>([
  "database",
  "debugging",
  "review",
  "security",
  "ui",
  "research",
  "privacy",
  "performance",
  "evolution",
  "focus",
  "engineering",
]);
const STALE_LOCK_MS = 30_000;
const LOCK_RETRY_MS = 20;
const STATE_KEYS = new Set([
  "version",
  "sessionDigest",
  "evidencePending",
  "commandDigest",
  "lastKind",
  "lastExitCode",
  "route",
  "updatedAt",
  "pending",
]);
const PENDING_KEYS = new Set(["kind", "route", "commandDigest", "startedAt"]);

export function classifyTerminalCommand(command: string) {
  const normalized = command.trim();
  const scoped = normalized.replace(/^cd\s+\S+\s*&&\s*/, "");
  const masksExitStatus = /(?:\r|\n|\|\||&&|[;&|`]|\$\()/.test(scoped);
  const kind: TerminalCommandKind = !masksExitStatus
    && !hasNonExecutingVerificationMode(scoped)
    && (isPackageVerificationCommand(scoped) || verification.test(scoped))
    ? "verification"
    : mutation.test(normalized)
      ? "mutation"
      : agent.test(normalized)
        ? "agent"
        : "other";
  return Object.freeze({
    kind,
    route: classifyPrompt(normalized).profile,
    commandDigest: digest(normalized),
  });
}

function blankState(session: string, now = Date.now()): StoredTerminalState {
  return {
    version: 1,
    sessionDigest: digest(session),
    evidencePending: false,
    commandDigest: digest(""),
    lastKind: "other",
    lastExitCode: null,
    route: "engineering",
    updatedAt: now,
  };
}

function conservativeState(session: string, now = Date.now()): StoredTerminalState {
  return {
    ...blankState(session, now),
    evidencePending: true,
  };
}

const statePath = (dataDir: string, session: string) => join(dataDir, `${digest(session)}.json`);
const lockPath = (dataDir: string, session: string) => `${statePath(dataDir, session)}.lock`;

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

function validTimestamp(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validPending(value: unknown): value is PendingCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (Object.keys(value).some((key) => !PENDING_KEYS.has(key))) return false;
  const pending = value as Partial<PendingCommand>;
  return COMMAND_KINDS.has(pending.kind as TerminalCommandKind)
    && TASK_PROFILES.has(pending.route as TaskProfile)
    && typeof pending.commandDigest === "string"
    && DIGEST_PATTERN.test(pending.commandDigest)
    && validTimestamp(pending.startedAt);
}

function parseStoredState(value: unknown, session: string): StoredTerminalState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.keys(value).some((key) => !STATE_KEYS.has(key))) return null;
  const state = value as Partial<StoredTerminalState>;
  if (state.version !== 1 || state.sessionDigest !== digest(session)) return null;
  if (typeof state.evidencePending !== "boolean") return null;
  if (typeof state.commandDigest !== "string" || !DIGEST_PATTERN.test(state.commandDigest)) return null;
  if (!COMMAND_KINDS.has(state.lastKind as TerminalCommandKind)) return null;
  if (state.lastExitCode !== null && !Number.isInteger(state.lastExitCode)) return null;
  if (!TASK_PROFILES.has(state.route as TaskProfile)) return null;
  if (!validTimestamp(state.updatedAt)) return null;
  if (state.pending !== undefined && !validPending(state.pending)) return null;
  if (state.pending !== undefined && (
    state.lastExitCode !== null
    || (state.pending.kind === "mutation" && state.evidencePending !== true)
    || state.lastKind !== state.pending.kind
    || state.route !== state.pending.route
    || state.commandDigest !== state.pending.commandDigest
    || state.updatedAt !== state.pending.startedAt
  )) return null;
  const canonical: StoredTerminalState = {
    version: 1,
    sessionDigest: state.sessionDigest,
    evidencePending: state.evidencePending,
    commandDigest: state.commandDigest,
    lastKind: state.lastKind,
    lastExitCode: state.lastExitCode,
    route: state.route,
    updatedAt: state.updatedAt,
    ...(state.pending === undefined ? {} : { pending: state.pending }),
  } as StoredTerminalState;
  return canonical;
}

async function load(dataDir: string, session: string): Promise<StoredTerminalState> {
  const target = statePath(dataDir, session);
  if (!await assertSafeRegularFile(target, true)) return blankState(session);
  try {
    const parsed = JSON.parse(await readFile(target, "utf8")) as unknown;
    return parseStoredState(parsed, session) ?? conservativeState(session);
  } catch (error) {
    if (error instanceof SyntaxError) return conservativeState(session);
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return blankState(session);
    return conservativeState(session);
  }
}

async function save(dataDir: string, session: string, state: StoredTerminalState) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const target = statePath(dataDir, session);
  await assertSafeRegularFile(target, true);
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(state)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function lockOwnerAlive(path: string): Promise<boolean | null> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as { pid?: unknown };
    if (!Number.isInteger(parsed.pid) || (parsed.pid as number) <= 0) return null;
    try {
      process.kill(parsed.pid as number, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "EPERM" ? true : false;
    }
  } catch {
    return null;
  }
}

async function withSessionLock<T>(dataDir: string, session: string, action: () => Promise<T>) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const path = lockPath(dataDir, session);

  for (;;) {
    let handle;
    try {
      handle = await open(path, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const entry = await existingFileKind(path);
      if (!entry) continue;
      if (entry.isSymbolicLink()) throw new Error("unsafe symlink state path");
      if (!entry.isFile()) throw new Error("unsafe non-file state path");
      const ownerAlive = await lockOwnerAlive(path);
      if (ownerAlive === false) {
        await rm(path, { force: true });
        continue;
      }
      if (ownerAlive === null && Date.now() - entry.mtimeMs > STALE_LOCK_MS) {
        await rm(path, { force: true });
        continue;
      }
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
      await rm(path, { force: true });
    }
  }
}

function publicState(state: StoredTerminalState): TerminalState {
  const { pending: _pending, ...result } = state;
  return result;
}

export async function recordTerminalPreexec(
  dataDir: string,
  session: string,
  command: string,
  now = Date.now(),
): Promise<TerminalPreexecTransition> {
  return withSessionLock(dataDir, session, async () => {
    const current = await load(dataDir, session);
    const classified = classifyTerminalCommand(command);
    await save(dataDir, session, {
      ...current,
      evidencePending: current.evidencePending || classified.kind === "mutation",
      commandDigest: classified.commandDigest,
      lastKind: classified.kind,
      lastExitCode: null,
      route: classified.route,
      updatedAt: now,
      pending: { ...classified, startedAt: now },
    });
    return Object.freeze({ ...classified, startedAt: now });
  });
}

export async function recordTerminalPostexec(
  dataDir: string,
  session: string,
  exitCode: number,
  now = Date.now(),
): Promise<TerminalPostexecResult> {
  return withSessionLock(dataDir, session, async () => {
    const current = await load(dataDir, session);
    const pending = current.pending;
    if (!pending) return publicState(current);

    const evidencePending = pending.kind === "mutation"
      ? true
      : pending.kind === "verification" && exitCode === 0
        ? false
        : current.evidencePending;
    const next: StoredTerminalState = {
      version: 1,
      sessionDigest: current.sessionDigest,
      evidencePending,
      commandDigest: pending.commandDigest,
      lastKind: pending.kind,
      lastExitCode: exitCode,
      route: pending.route,
      updatedAt: now,
    };
    await save(dataDir, session, next);
    return Object.freeze({
      ...publicState(next),
      transition: Object.freeze({
        kind: pending.kind,
        route: pending.route,
        commandDigest: pending.commandDigest,
        exitCode,
        startedAt: pending.startedAt,
        completedAt: now,
      }),
    });
  });
}

export async function readTerminalState(dataDir: string, session: string): Promise<TerminalState> {
  return publicState(await load(dataDir, session));
}

export function formatTerminalStatusLine(state: TerminalState): string {
  const statusBadge = state.evidencePending ? "🔴 MUTATION PENDING" : "🟢 VERIFIED";
  const routeBadge = `[Path: ${state.route.toUpperCase()}]`;
  const lastExitBadge = state.lastExitCode !== null ? `Exit: ${state.lastExitCode}` : "Active";
  return `RIQOR STATUS | ${statusBadge} | ${routeBadge} | Last Kind: ${state.lastKind} | ${lastExitBadge}`;
}
