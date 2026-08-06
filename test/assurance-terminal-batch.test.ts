import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { appendFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRun, readRun, readRunEvents } from "../src/assurance/run-store";
import { recordActiveRunTerminalTransition } from "../src/assurance/terminal-trace";
import type { RepositoryIdentity, RepositoryLocation } from "../src/assurance/repository-identity";
import type { TerminalPostexecTransition } from "../src/terminal-runtime";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function transition(marker: string): TerminalPostexecTransition {
  return {
    kind: "mutation",
    route: "engineering",
    commandDigest: createHash("sha256").update(marker).digest("hex"),
    exitCode: 0,
    startedAt: 1,
    completedAt: 2,
  };
}

test("skips full repository inspection when no active run exists", async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), "riqor-no-active-"));
  temporaryPaths.push(stateRoot);
  let inspections = 0;
  const location: RepositoryLocation = {
    rootDigest: "a".repeat(64),
    rootPath: "/unused",
    gitRepository: true,
  };

  const result = await recordActiveRunTerminalTransition({
    stateRoot,
    cwd: "/unused",
    transition: transition("unused"),
    locateRepository: async () => location,
    inspectRepository: async () => {
      inspections += 1;
      throw new Error("full inspection should not run");
    },
  });

  expect(result).toBeNull();
  expect(inspections).toBe(0);
});

test("keeps concurrent mutation event groups contiguous", async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), "riqor-batch-lock-"));
  temporaryPaths.push(stateRoot);
  const identity: RepositoryIdentity = {
    rootDigest: "b".repeat(64),
    headSha: "c".repeat(40),
    dirty: false,
    rootPath: "/batch",
  };
  await createRun({
    stateRoot,
    identity,
    goal: "Keep event groups contiguous",
    pathId: "evidence-loop",
    profileId: "assured",
    randomId: () => "batch-run",
  });
  const location: RepositoryLocation = {
    rootDigest: identity.rootDigest,
    rootPath: identity.rootPath,
    gitRepository: true,
  };

  await Promise.all(["one", "two"].map((marker) => recordActiveRunTerminalTransition({
    stateRoot,
    cwd: identity.rootPath,
    transition: transition(marker),
    locateRepository: async () => location,
    inspectRepository: async () => identity,
  })));

  const events = await readRunEvents({ stateRoot, identity, runId: "batch-run" });
  expect(events.slice(1, 4).map((event) => event.type)).toEqual([
    "command_completed",
    "workspace_mutated",
    "verification_required",
  ]);
  expect(events.slice(4, 7).map((event) => event.type)).toEqual([
    "command_completed",
    "workspace_mutated",
    "verification_required",
  ]);
});

test("rejects malformed trace fields with a controlled schema error", async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), "riqor-malformed-event-"));
  temporaryPaths.push(stateRoot);
  const identity: RepositoryIdentity = {
    rootDigest: "d".repeat(64),
    headSha: "e".repeat(40),
    dirty: false,
    rootPath: "/malformed",
  };
  const run = await createRun({
    stateRoot,
    identity,
    goal: "Reject malformed trace data",
    pathId: "evidence-loop",
    profileId: "assured",
    randomId: () => "malformed-run",
  });
  const eventsPath = join(
    stateRoot,
    "projects",
    identity.rootDigest,
    "runs",
    run.runId,
    "events.jsonl",
  );
  await appendFile(eventsPath, `${JSON.stringify({
    schemaVersion: 1,
    eventId: "bad-subject",
    sequence: 2,
    runId: run.runId,
    runGroupId: run.runGroupId,
    source: "terminal",
    type: "command_completed",
    status: "success",
    timestamp: new Date().toISOString(),
    subject: null,
  })}\n`);

  await expect(readRun({ stateRoot, identity, runId: run.runId }))
    .rejects.toThrow("invalid trace event subject");
});

test("isolates trace persistence failures from terminal tracking", async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), "riqor-trace-isolation-"));
  temporaryPaths.push(stateRoot);
  const identity: RepositoryIdentity = {
    rootDigest: "f".repeat(64),
    headSha: "1".repeat(40),
    dirty: false,
    rootPath: "/isolation",
  };
  const run = await createRun({
    stateRoot,
    identity,
    goal: "Keep shell tracking alive",
    pathId: "evidence-loop",
    profileId: "assured",
    randomId: () => "isolation-run",
  });
  const runPath = join(
    stateRoot,
    "projects",
    identity.rootDigest,
    "runs",
    run.runId,
    "run.json",
  );
  await appendFile(runPath, "not-json");
  let warning = "";

  const result = await recordActiveRunTerminalTransition({
    stateRoot,
    cwd: identity.rootPath,
    transition: transition("isolation"),
    locateRepository: async () => ({
      rootDigest: identity.rootDigest,
      rootPath: identity.rootPath,
      gitRepository: true,
    }),
    inspectRepository: async () => identity,
    onWarning: (error) => {
      warning = error.message;
    },
  });

  expect(result).toBeNull();
  expect(warning).toContain("invalid run JSON");
});
