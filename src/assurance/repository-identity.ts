import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

export type RepositoryIdentity = Readonly<{
  rootDigest: string;
  headSha: string | null;
  dirty: boolean;
  rootPath: string;
}>;

export type RepositoryLocation = Readonly<{
  rootDigest: string;
  rootPath: string;
  gitRepository: boolean;
}>;

export type GitCommandResult = Readonly<{
  ok: boolean;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}>;

export type GitRunner = (cwd: string, args: readonly string[]) => GitCommandResult;

type ProcessEnvironment = Record<string, string | undefined>;

const UNSUPPORTED_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const GIT_COMMAND_TIMEOUT_MS = 1_000;
const GIT_MAX_BUFFER_BYTES = 1_048_576;

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stripFinalLineTerminator(value: string) {
  return value.replace(/\r?\n$/, "");
}

const RUN_GIT: GitRunner = (cwd, args) => {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: GIT_COMMAND_TIMEOUT_MS,
    maxBuffer: GIT_MAX_BUFFER_BYTES,
  });
  return Object.freeze({
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    timedOut: (result.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT",
  });
};

export function normalizeRunGoal(value: string) {
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized) throw new Error("goal is required");
  if (UNSUPPORTED_CONTROL_CHARACTERS.test(normalized)) {
    throw new Error("goal contains unsupported control characters");
  }
  if (Array.from(normalized).length > 2000) {
    throw new Error("goal exceeds 2000 characters");
  }
  return normalized;
}

export function resolveRiqorStateRoot(
  env: ProcessEnvironment = process.env,
  home = homedir(),
) {
  if (env.RIQOR_STATE_HOME) return resolve(env.RIQOR_STATE_HOME);
  if (env.XDG_STATE_HOME) return resolve(env.XDG_STATE_HOME, "riqor");
  return resolve(home, ".local", "state", "riqor");
}

export async function locateRepositoryIdentity(
  cwd: string,
  runGit: GitRunner = RUN_GIT,
): Promise<RepositoryLocation> {
  const canonicalCwd = await realpath(resolve(cwd));
  const rootResult = runGit(canonicalCwd, ["rev-parse", "--show-toplevel"]);
  if (rootResult.timedOut) throw new Error("git repository inspection timed out");
  const gitRoot = stripFinalLineTerminator(rootResult.stdout);
  const gitRepository = rootResult.ok && gitRoot.length > 0;
  const rootPath = await realpath(gitRepository ? gitRoot : canonicalCwd);
  return Object.freeze({
    rootDigest: digest(rootPath),
    rootPath,
    gitRepository,
  });
}

export async function inspectRepositoryIdentity(
  cwd: string,
  options: Readonly<{
    runGit?: GitRunner;
    location?: RepositoryLocation;
  }> = {},
): Promise<RepositoryIdentity> {
  const runGit = options.runGit ?? RUN_GIT;
  const location = options.location ?? await locateRepositoryIdentity(cwd, runGit);
  if (!location.gitRepository) {
    return Object.freeze({
      rootDigest: location.rootDigest,
      rootPath: location.rootPath,
      headSha: null,
      dirty: false,
    });
  }

  const headResult = runGit(location.rootPath, ["rev-parse", "--verify", "HEAD"]);
  if (headResult.timedOut) throw new Error("git head inspection timed out");
  const statusResult = runGit(location.rootPath, [
    "status",
    "--porcelain",
    "--untracked-files=normal",
  ]);
  if (statusResult.timedOut) throw new Error("git status inspection timed out");
  if (!statusResult.ok) {
    const detail = stripFinalLineTerminator(statusResult.stderr);
    throw new Error(`git status inspection failed${detail ? `: ${detail}` : ""}`);
  }

  const head = stripFinalLineTerminator(headResult.stdout);
  return Object.freeze({
    rootDigest: location.rootDigest,
    rootPath: location.rootPath,
    headSha: headResult.ok && /^[a-f0-9]{40}$/i.test(head) ? head.toLowerCase() : null,
    dirty: statusResult.stdout.length > 0,
  });
}
