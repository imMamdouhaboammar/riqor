import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dir, "..");
const cli = join(root, "src", "harness-cli.ts");
const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function git(cwd: string, ...args: string[]) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", shell: false });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
}

async function fixture() {
  const repository = await mkdtemp(join(tmpdir(), "riqor-assurance-cli-repo-"));
  const stateRoot = await mkdtemp(join(tmpdir(), "riqor-assurance-cli-state-"));
  const terminalRoot = await mkdtemp(join(tmpdir(), "riqor-assurance-cli-terminal-"));
  temporaryPaths.push(repository, stateRoot, terminalRoot);
  git(repository, "init", "-q");
  git(repository, "config", "user.email", "test@example.com");
  git(repository, "config", "user.name", "Test");
  await writeFile(join(repository, "README.md"), "fixture\n");
  git(repository, "add", "README.md");
  git(repository, "commit", "-qm", "initial");
  return {
    repository,
    env: {
      RIQOR_STATE_HOME: stateRoot,
      CODEX_SELF_IMPROVEMENT_DATA: terminalRoot,
    },
  };
}

function run(cwd: string, args: string[], env: Record<string, string>) {
  return Bun.spawnSync(["bun", "run", cli, ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
}

describe("assurance CLI", () => {
  test("starts, traces, verifies, and completes a repository-scoped run", async () => {
    const { repository, env } = await fixture();
    const started = run(repository, [
      "run",
      "start",
      "--goal",
      "Add trace records",
      "--path",
      "evidence-loop",
      "--profile",
      "assured",
      "--json",
    ], env);
    expect(started.exitCode).toBe(0);
    const created = JSON.parse(started.stdout.toString());
    expect(created).toEqual(expect.objectContaining({
      goal: "Add trace records",
      pathId: "evidence-loop",
      profileId: "assured",
      status: "active",
    }));

    const status = run(repository, ["run", "status", "--json"], env);
    expect(status.exitCode).toBe(0);
    expect(JSON.parse(status.stdout.toString()).runId).toBe(created.runId);

    const initialTrace = run(repository, ["trace", "show", created.runId, "--json"], env);
    expect(initialTrace.exitCode).toBe(0);
    expect(JSON.parse(initialTrace.stdout.toString()).map((event: any) => event.type))
      .toEqual(["run_started"]);

    const secretCommand = "printf sk-private-cli-marker > src/a.ts";
    expect(run(repository, [
      "terminal",
      "preexec",
      "--session",
      "assurance-cli",
      "--command",
      secretCommand,
    ], env).exitCode).toBe(0);
    expect(run(repository, [
      "terminal",
      "postexec",
      "--session",
      "assurance-cli",
      "--exit-code",
      "0",
    ], env).exitCode).toBe(0);

    const blocked = run(repository, ["run", "complete", "--json"], env);
    expect(blocked.exitCode).toBe(64);
    expect(blocked.stderr.toString()).toContain("verification is still pending");

    expect(run(repository, [
      "terminal",
      "preexec",
      "--session",
      "assurance-cli",
      "--command",
      "bun test",
    ], env).exitCode).toBe(0);
    expect(run(repository, [
      "terminal",
      "postexec",
      "--session",
      "assurance-cli",
      "--exit-code",
      "0",
    ], env).exitCode).toBe(0);

    const completed = run(repository, ["run", "complete", "--json"], env);
    expect(completed.exitCode).toBe(0);
    expect(JSON.parse(completed.stdout.toString()).status).toBe("completed");
    expect(JSON.parse(run(repository, ["run", "status", "--json"], env).stdout.toString())).toBeNull();

    const exported = run(repository, ["trace", "export", created.runId, "--format", "jsonl"], env);
    expect(exported.exitCode).toBe(0);
    const events = exported.stdout.toString().trim().split("\n").map((line) => JSON.parse(line));
    expect(events.at(-1)?.type).toBe("run_completed");
    expect(exported.stdout.toString()).not.toContain(secretCommand);
    expect(exported.stdout.toString()).not.toContain("sk-private-cli-marker");
  });

  test("validates required goal, path, profile, and trace format", async () => {
    const { repository, env } = await fixture();
    expect(run(repository, ["run", "start", "--json"], env).exitCode).toBe(64);

    const badPath = run(repository, [
      "run",
      "start",
      "--goal",
      "Bad path",
      "--path",
      "missing-path",
      "--json",
    ], env);
    expect(badPath.exitCode).toBe(64);
    expect(badPath.stderr.toString()).toContain("unknown harness path");

    const badProfile = run(repository, [
      "run",
      "start",
      "--goal",
      "Bad profile",
      "--profile",
      "turbo",
      "--json",
    ], env);
    expect(badProfile.exitCode).toBe(64);
    expect(badProfile.stderr.toString()).toContain("unknown execution profile");

    const started = run(repository, ["run", "start", "--goal", "Trace format", "--json"], env);
    const runId = JSON.parse(started.stdout.toString()).runId;
    const badFormat = run(repository, ["trace", "export", runId, "--format", "json"], env);
    expect(badFormat.exitCode).toBe(64);
    expect(badFormat.stderr.toString()).toContain("trace export supports only jsonl");
  });

  test("reads an explicit completed run after the active pointer is cleared", async () => {
    const { repository, env } = await fixture();
    const started = run(repository, ["run", "start", "--goal", "Explicit status", "--json"], env);
    const runId = JSON.parse(started.stdout.toString()).runId;
    expect(run(repository, ["run", "complete", "--json"], env).exitCode).toBe(0);
    const status = run(repository, ["run", "status", "--run", runId, "--json"], env);
    expect(status.exitCode).toBe(0);
    expect(JSON.parse(status.stdout.toString()).status).toBe("completed");
  });
});
