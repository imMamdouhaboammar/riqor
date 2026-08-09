import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { runProcess } from "./process";

const allowedEnvironment = ["PATH", "LANG", "LC_ALL", "LC_CTYPE", "TERM", "TZ", "USER", "LOGNAME", "SHELL", "NO_COLOR"];

function isInside(candidate: string, root: string) {
  const relation = relative(root, candidate);
  return relation === "" || (!isAbsolute(relation) && relation !== ".." && !relation.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`));
}

export function assertIsolatableRepo(repo: string) {
  const candidates = new Set([resolve(repo), realpathSync(repo)]);
  const temporaryRoots = new Set([resolve(tmpdir()), realpathSync(tmpdir())]);
  if (process.platform === "darwin") {
    temporaryRoots.add(resolve("/tmp"));
    temporaryRoots.add(realpathSync("/tmp"));
  }
  if ([...candidates].some((candidate) => [...temporaryRoots].some((root) => isInside(candidate, root)))) {
    throw new Error("refusing to sandbox a repository inside OS temporary storage");
  }
}

function sandboxConfig(harnessRoot: string, checkRoot: string, repo: string, bunExecutable: string) {
  const graderRoot = JSON.stringify(join(harnessRoot, "graders"));
  const holdoutGraderRoot = JSON.stringify(join(harnessRoot, "holdouts", "graders"));
  const deniedRepoParent = JSON.stringify(resolve(dirname(repo)));
  const writableRepo = JSON.stringify(resolve(repo));
  const writableCheckRoot = JSON.stringify(checkRoot);
  const readableBun = JSON.stringify(bunExecutable);
  return `default_permissions = "isolated-check"

[permissions.isolated-check]
extends = ":workspace"

[permissions.isolated-check.filesystem]
":root" = "deny"
":minimal" = "read"
":tmpdir" = "deny"
":slash_tmp" = "deny"
${deniedRepoParent} = "deny"
${writableRepo} = "write"
${graderRoot} = "read"
${holdoutGraderRoot} = "read"
${writableCheckRoot} = "write"
${readableBun} = "read"

[permissions.isolated-check.network]
enabled = false

[shell_environment_policy]
inherit = "all"
ignore_default_excludes = false
include_only = ["PATH", "LANG", "LC_ALL", "LC_CTYPE", "TERM", "TZ", "USER", "LOGNAME", "SHELL", "NO_COLOR", "CODEX_HOME", "HOME", "TMPDIR", "CODEX_HARNESS_PROCESS_MARKER"]
`;
}

function checkEnvironment(
  base: NodeJS.ProcessEnv,
  checkRoot: string,
  home: string,
  temporary: string,
) {
  const environment: NodeJS.ProcessEnv = {};
  for (const name of allowedEnvironment) if (base[name] !== undefined) environment[name] = base[name];
  environment.PATH ??= "/opt/homebrew/bin:/usr/bin:/bin";
  environment.CODEX_HOME = checkRoot;
  environment.HOME = home;
  environment.TMPDIR = temporary;
  return environment;
}

export async function runSandboxedCheck(
  command: string[],
  repo: string,
  harnessRoot: string,
  baseEnvironment: NodeJS.ProcessEnv = process.env,
  timeoutMs = 2 * 60 * 1000,
) {
  assertIsolatableRepo(repo);
  const checkRoot = await mkdtemp(join(tmpdir(), "codex-harness-check-"));
  const home = join(checkRoot, "home");
  const temporary = join(checkRoot, "tmp");
  const bunExecutable = realpathSync(Bun.which("bun") ?? process.execPath);
  try {
    await chmod(checkRoot, 0o700);
    await Promise.all([mkdir(home, { mode: 0o700 }), mkdir(temporary, { mode: 0o700 })]);
    await writeFile(join(checkRoot, "config.toml"), sandboxConfig(harnessRoot, checkRoot, repo, bunExecutable), { mode: 0o600 });
    const hasCodex = Boolean(Bun.which("codex"));
    const cmd = hasCodex
      ? ["codex", "sandbox", "-P", "isolated-check", "-C", repo, "--", ...command]
      : command;
    const execution = await runProcess(
      cmd,
      repo,
      checkEnvironment(baseEnvironment, checkRoot, home, temporary),
      timeoutMs,
    );
    return {
      exitCode: execution.exitCode,
      stdout: execution.stdout,
      stderr: execution.stderr,
    };
  } finally {
    await rm(checkRoot, { recursive: true, force: true });
  }
}

export { autoHealEnvironment } from "./doctor-auto-healer.js";
