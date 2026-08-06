import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendRunEvent,
  completeRun,
  createRun,
  readActiveRun,
  readRun,
  readRunEvents,
  transitionRun,
} from "../src/assurance/run-store";
import type { RepositoryIdentity } from "../src/assurance/repository-identity";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function fixture() {
  const stateRoot = await mkdtemp(join(tmpdir(), "riqor-run-store-"));
  temporaryPaths.push(stateRoot);
  const identity: RepositoryIdentity = {
    rootDigest: "a".repeat(64),
    headSha: "b".repeat(40),
    dirty: false,
    rootPath: "/private/project-that-must-not-be-persisted",
  };
  return { stateRoot, identity };
}

function projectDirectory(stateRoot: string, rootDigest: string) {
  return join(stateRoot, "projects", rootDigest);
}

function runDirectory(stateRoot: string, rootDigest: string, runId: string) {
  return join(projectDirectory(stateRoot, rootDigest), "runs", runId);
}

describe("assurance run store", () => {
  test("creates one active run with an initial trace event", async () => {
    const { stateRoot, identity } = await fixture();
    const run = await createRun({
      stateRoot,
      identity,
      goal: "Add trace records",
      pathId: "evidence-loop",
      profileId: "assured",
      now: new Date("2026-08-06T20:00:00.000Z"),
      randomId: () => "run-1",
    });

    expect(run).toEqual(expect.objectContaining({
      runId: "run-1",
      runGroupId: "run-1",
      goal: "Add trace records",
      status: "active",
      nextSequence: 2,
    }));
    expect((await readActiveRun({ stateRoot, identity }))?.runId).toBe("run-1");
    expect(await readRunEvents({ stateRoot, identity, runId: "run-1" })).toEqual([
      expect.objectContaining({
        sequence: 1,
        type: "run_started",
        status: "success",
      }),
    ]);
  });

  test("rejects a second active run and never persists the raw repository path", async () => {
    const { stateRoot, identity } = await fixture();
    await createRun({
      stateRoot,
      identity,
      goal: "First run",
      pathId: "evidence-loop",
      profileId: "standard",
      randomId: () => "run-1",
    });

    await expect(createRun({
      stateRoot,
      identity,
      goal: "Second run",
      pathId: "secure-change",
      profileId: "assured",
      randomId: () => "run-2",
    })).rejects.toThrow("an active run already exists");

    const project = projectDirectory(stateRoot, identity.rootDigest);
    const state = [
      await readFile(join(project, "active.json"), "utf8"),
      await readFile(join(project, "runs", "run-1", "run.json"), "utf8"),
      await readFile(join(project, "runs", "run-1", "events.jsonl"), "utf8"),
    ].join("\n");
    expect(state).not.toContain(identity.rootPath);
  });

  test("appends ordered events and applies explicit state transitions", async () => {
    const { stateRoot, identity } = await fixture();
    await createRun({
      stateRoot,
      identity,
      goal: "Trace ordering",
      pathId: "evidence-loop",
      profileId: "assured",
      randomId: () => "run-order",
    });

    await appendRunEvent({
      stateRoot,
      identity,
      runId: "run-order",
      source: "terminal",
      type: "workspace_mutated",
      status: "success",
      digest: "c".repeat(64),
      nextStatus: "verification-pending",
      now: new Date("2026-08-06T20:01:00.000Z"),
    });
    await appendRunEvent({
      stateRoot,
      identity,
      runId: "run-order",
      source: "terminal",
      type: "verification_completed",
      status: "success",
      nextStatus: "active",
      now: new Date("2026-08-06T20:02:00.000Z"),
    });

    expect((await readRunEvents({ stateRoot, identity, runId: "run-order" })).map((event) => event.sequence))
      .toEqual([1, 2, 3]);
    expect((await readRun({ stateRoot, identity, runId: "run-order" })).status).toBe("active");
  });

  test("fails closed for unknown run schema versions", async () => {
    const { stateRoot, identity } = await fixture();
    const directory = runDirectory(stateRoot, identity.rootDigest, "bad-run");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "run.json"), JSON.stringify({ schemaVersion: 2, runId: "bad-run" }));
    await expect(readRun({ stateRoot, identity, runId: "bad-run" })).rejects.toThrow("unsupported run schema");
  });

  test("recovers a stale regular lock before appending", async () => {
    const { stateRoot, identity } = await fixture();
    await createRun({
      stateRoot,
      identity,
      goal: "Stale lock",
      pathId: "evidence-loop",
      profileId: "standard",
      randomId: () => "run-stale",
    });
    const lockPath = join(runDirectory(stateRoot, identity.rootDigest, "run-stale"), ".lock");
    await writeFile(lockPath, "stale", { mode: 0o600 });
    await utimes(lockPath, new Date(0), new Date(0));

    const event = await appendRunEvent({
      stateRoot,
      identity,
      runId: "run-stale",
      source: "riqor",
      type: "command_completed",
      status: "success",
      lockTimeoutMs: 100,
      staleLockMs: 1,
    });
    expect(event.sequence).toBe(2);
  });

  test("times out on a live lock and rejects symlink state files", async () => {
    const { stateRoot, identity } = await fixture();
    await createRun({
      stateRoot,
      identity,
      goal: "Live lock",
      pathId: "evidence-loop",
      profileId: "standard",
      randomId: () => "run-live",
    });
    const directory = runDirectory(stateRoot, identity.rootDigest, "run-live");
    await writeFile(join(directory, ".lock"), "live", { mode: 0o600 });
    await expect(appendRunEvent({
      stateRoot,
      identity,
      runId: "run-live",
      source: "riqor",
      type: "command_completed",
      status: "success",
      lockTimeoutMs: 30,
      staleLockMs: 60_000,
    })).rejects.toThrow("run state is busy");

    await rm(join(directory, ".lock"));
    await rm(join(directory, "run.json"));
    const target = join(directory, "target.json");
    await writeFile(target, "{}", { mode: 0o600 });
    await symlink(target, join(directory, "run.json"));
    await expect(readRun({ stateRoot, identity, runId: "run-live" })).rejects.toThrow("unsafe symlink state path");
  });

  test("blocks pending completion and closes a verified active run", async () => {
    const { stateRoot, identity } = await fixture();
    await createRun({
      stateRoot,
      identity,
      goal: "Completion gate",
      pathId: "evidence-loop",
      profileId: "assured",
      randomId: () => "run-complete",
    });
    await transitionRun({
      stateRoot,
      identity,
      runId: "run-complete",
      status: "verification-pending",
    });
    await expect(completeRun({ stateRoot, identity, runId: "run-complete" }))
      .rejects.toThrow("verification is still pending");

    await transitionRun({ stateRoot, identity, runId: "run-complete", status: "active" });
    const completed = await completeRun({
      stateRoot,
      identity,
      runId: "run-complete",
      now: new Date("2026-08-06T21:00:00.000Z"),
    });
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBe("2026-08-06T21:00:00.000Z");
    expect(await readActiveRun({ stateRoot, identity })).toBeNull();
    expect((await readRunEvents({ stateRoot, identity, runId: "run-complete" })).at(-1)?.type)
      .toBe("run_completed");
  });

  test("does not resolve a run through another repository digest", async () => {
    const { stateRoot, identity } = await fixture();
    await createRun({
      stateRoot,
      identity,
      goal: "Repository boundary",
      pathId: "evidence-loop",
      profileId: "standard",
      randomId: () => "run-boundary",
    });
    const otherIdentity = { ...identity, rootDigest: "f".repeat(64) };
    await expect(readRun({ stateRoot, identity: otherIdentity, runId: "run-boundary" }))
      .rejects.toThrow("run not found");
  });
});
