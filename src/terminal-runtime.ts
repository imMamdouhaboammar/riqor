import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { classifyPrompt, type TaskProfile } from "../plugins/riqor/hooks/router";
import { isPackageVerificationCommand } from "../plugins/riqor/hooks/verification-command";

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

export function classifyTerminalCommand(command: string) {
  const normalized = command.trim();
  const scoped = normalized.replace(/^cd\s+\S+\s*&&\s*/, "");
  const masksExitStatus = /(?:\|\||&&|[;&|`]|\$\()/.test(scoped);
  const kind: TerminalCommandKind = !masksExitStatus
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

const statePath = (dataDir: string, session: string) => join(dataDir, `${digest(session)}.json`);

async function load(dataDir: string, session: string): Promise<StoredTerminalState> {
  try {
    const parsed = JSON.parse(await readFile(statePath(dataDir, session), "utf8")) as StoredTerminalState;
    return parsed.version === 1 && parsed.sessionDigest === digest(session) ? parsed : blankState(session);
  } catch {
    return blankState(session);
  }
}

async function save(dataDir: string, session: string, state: StoredTerminalState) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const target = statePath(dataDir, session);
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state)}\n`, { mode: 0o600 });
  await rename(temporary, target);
}

function publicState(state: StoredTerminalState): TerminalState {
  const { pending: _pending, ...result } = state;
  return result;
}

export async function recordTerminalPreexec(dataDir: string, session: string, command: string, now = Date.now()) {
  const current = await load(dataDir, session);
  const classified = classifyTerminalCommand(command);
  await save(dataDir, session, {
    ...current,
    commandDigest: classified.commandDigest,
    lastKind: classified.kind,
    lastExitCode: null,
    route: classified.route,
    updatedAt: now,
    pending: { ...classified, startedAt: now },
  });
  return classified;
}

export async function recordTerminalPostexec(
  dataDir: string,
  session: string,
  exitCode: number,
  now = Date.now(),
): Promise<TerminalPostexecResult> {
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
