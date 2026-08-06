import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export type RepositoryIdentity = Readonly<{
  rootDigest: string;
  headSha: string | null;
  dirty: boolean;
  rootPath: string;
}>;

type ProcessEnvironment = Record<string, string | undefined>;

const unsupportedControlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function git(cwd: string, args: readonly string[]) {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
  };
}

export function normalizeRunGoal(value: string) {
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized) throw new Error("goal is required");
  if (unsupportedControlCharacters.test(normalized)) {
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
  return join(resolve(home), ".local", "state", "riqor");
}

export async function inspectRepositoryIdentity(cwd: string): Promise<RepositoryIdentity> {
  const canonicalCwd = await realpath(resolve(cwd));
  const rootResult = git(canonicalCwd, ["rev-parse", "--show-toplevel"]);
  const rootPath = await realpath(rootResult.ok && rootResult.stdout ? rootResult.stdout : canonicalCwd);

  const headResult = git(rootPath, ["rev-parse", "--verify", "HEAD"]);
  const statusResult = git(rootPath, ["status", "--porcelain", "--untracked-files=normal"]);

  return Object.freeze({
    rootDigest: digest(rootPath),
    headSha: headResult.ok && /^[a-f0-9]{40}$/i.test(headResult.stdout)
      ? headResult.stdout.toLowerCase()
      : null,
    dirty: statusResult.ok ? statusResult.stdout.length > 0 : false,
    rootPath,
  });
}
