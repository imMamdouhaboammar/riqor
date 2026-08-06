import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectRepositoryIdentity } from "../src/assurance/repository-identity";
import { createRun, readRun, readRunEvents } from "../src/assurance/run-store";
import { recordActiveRunTerminalTransition } from "../src/assurance/terminal-trace";
import type { TerminalPostexecTransition } from "../src/terminal-runtime";
import { runGit } from "./helpers/git";

const TEMPORARY_PATHS: string[] = [];

afterEach(async () => {
  await Promise.all(TEMPORARY_PATHS.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function fixture() {
  const stateRoot = await mkdtemp(join(tmpdir(), "riqor-terminal-trace-state-"));
  const repository = await mkdtemp(join(tmpdir(), "riqor-terminal-trace-repo-"));
  TEMPORARY_PATHS.push(stateRoot, repository);
  runGit(repository, "init", "-q");
  runGit(repository, "config", "user.email", "test@example.com");
  runGit(repository, "config", "user.name", "Test");
  await writeFile(join(repository, "README.md"), "fixture\n");
  runGit(repository, "add", "README.md");
  runGit(repository, "commit", "-qm", "initial");
  const identity = await inspectRepositoryIdentity(repository);
  await createRun({
    stateRoot,
    identity,
    goal: "Trace terminal evidence",
    pathId: "evidence-loop",
    profileId: "assured",
    randomId: () => "run-terminal",
  });
  return { stateRoot, repository, identity };
}

function transition(
  kind: TerminalPostexecTransition["kind"],
  exitCode: number,
  commandMarker: string,
  startedAt: number,
  completedAt: number,
): TerminalPostexecTransition {
  return {
    kind,
    route: "engineering",
    commandDigest: createHash("sha256").update(commandMarker).digest("hex"),
    exitCode,
    startedAt,
    completedAt,
  };
}

describe("active run terminal trace", () => {
  test("records mutation and verification transitions without raw commands", async () => {
    const { stateRoot, repository, identity } = await fixture();
    const secretMarker = "printf sk-private-terminal-marker > src/a.ts";

    await recordActiveRunTerminalTransition({
      stateRoot,
      cwd: repository,
      transition: transition("mutation", 0, secretMarker, 1000, 1100),
      now: new Date("2026-08-06T20:01:00.000Z"),
    });
    expect((await readRun({ stateRoot, identity, runId: "run-terminal" })).status)
      .toBe("verification-pending");

    let events = await readRunEvents({ stateRoot, identity, runId: "run-terminal" });
    expect(events.map((event) => event.type)).toEqual([
      "run_started",
      "command_completed",
      "workspace_mutated",
      "verification_required",
    ]);
    expect(events[1]?.metadata).toEqual(expect.objectContaining({
      kind: "mutation",
      exitCode: 0,
      durationMs: 100,
    }));

    await recordActiveRunTerminalTransition({
      stateRoot,
      cwd: repository,
      transition: transition("verification", 1, "bun test", 1200, 1300),
    });
    expect((await readRun({ stateRoot, identity, runId: "run-terminal" })).status)
      .toBe("verification-pending");

    await recordActiveRunTerminalTransition({
      stateRoot,
      cwd: repository,
      transition: transition("verification", 0, "bun test", 1400, 1500),
      now: new Date("2026-08-06T20:02:00.000Z"),
    });
    expect((await readRun({ stateRoot, identity, runId: "run-terminal" })).status)
      .toBe("active");

    events = await readRunEvents({ stateRoot, identity, runId: "run-terminal" });
    expect(events.at(-1)?.type).toBe("verification_completed");

    const runDirectory = join(stateRoot, "projects", identity.rootDigest, "runs", "run-terminal");
    const stored = [
      await readFile(join(runDirectory, "run.json"), "utf8"),
      await readFile(join(runDirectory, "events.jsonl"), "utf8"),
    ].join("\n");
    expect(stored).not.toContain(secretMarker);
    expect(stored).not.toContain("sk-private-terminal-marker");
  });

  test("does not create pending evidence for a failed mutation", async () => {
    const { stateRoot, repository, identity } = await fixture();
    await recordActiveRunTerminalTransition({
      stateRoot,
      cwd: repository,
      transition: transition("mutation", 1, "echo failure > src/a.ts", 1000, 1100),
    });
    expect((await readRun({ stateRoot, identity, runId: "run-terminal" })).status).toBe("active");
    expect((await readRunEvents({ stateRoot, identity, runId: "run-terminal" })).map((event) => event.type))
      .toEqual(["run_started", "command_completed"]);
  });

  test("returns null when the repository has no active run", async () => {
    const stateRoot = await mkdtemp(join(tmpdir(), "riqor-terminal-trace-empty-state-"));
    const repository = await mkdtemp(join(tmpdir(), "riqor-terminal-trace-empty-repo-"));
    TEMPORARY_PATHS.push(stateRoot, repository);
    const result = await recordActiveRunTerminalTransition({
      stateRoot,
      cwd: repository,
      transition: transition("other", 0, "pwd", 1000, 1001),
    });
    expect(result).toBeNull();
  });
});
