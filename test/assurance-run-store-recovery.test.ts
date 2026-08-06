import { afterEach, expect, test } from "bun:test";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendRunEvent,
  createRun,
  readRun,
  readRunEvents,
} from "../src/assurance/run-store";
import type { RepositoryIdentity } from "../src/assurance/repository-identity";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function fixture() {
  const stateRoot = await mkdtemp(join(tmpdir(), "riqor-run-recovery-"));
  temporaryPaths.push(stateRoot);
  const identity: RepositoryIdentity = {
    rootDigest: "3".repeat(64),
    headSha: "4".repeat(40),
    dirty: false,
    rootPath: "/private/recovery-project",
  };
  const run = await createRun({
    stateRoot,
    identity,
    goal: "Recover an interrupted trace write",
    pathId: "evidence-loop",
    profileId: "assured",
    randomId: () => "recovery-run",
  });
  const directory = join(
    stateRoot,
    "projects",
    identity.rootDigest,
    "runs",
    run.runId,
  );
  return {
    stateRoot,
    identity,
    run,
    runPath: join(directory, "run.json"),
    eventsPath: join(directory, "events.jsonl"),
  };
}

test("recovers a trace event committed before the run record update", async () => {
  const { stateRoot, identity, run, runPath, eventsPath } = await fixture();
  const interruptedEvent = {
    schemaVersion: 1,
    eventId: "interrupted-event",
    sequence: 2,
    runId: run.runId,
    runGroupId: run.runGroupId,
    source: "terminal",
    type: "command_completed",
    status: "success",
    timestamp: "2026-08-06T21:30:00.000Z",
    digest: "5".repeat(64),
    metadata: {
      kind: "mutation",
      route: "engineering",
      exitCode: 0,
      durationMs: 25,
    },
  };
  await appendFile(eventsPath, `${JSON.stringify(interruptedEvent)}\n`);

  const recovered = await readRun({ stateRoot, identity, runId: run.runId });
  expect(recovered.nextSequence).toBe(3);
  expect(recovered.status).toBe("verification-pending");
  expect(recovered.updatedAt).toBe(interruptedEvent.timestamp);
  expect(JSON.parse(await readFile(runPath, "utf8"))).toEqual(recovered);

  const next = await appendRunEvent({
    stateRoot,
    identity,
    runId: run.runId,
    source: "terminal",
    type: "verification_completed",
    status: "success",
    nextStatus: "active",
  });
  expect(next.sequence).toBe(3);
  expect((await readRunEvents({
    stateRoot,
    identity,
    runId: run.runId,
  })).map((event) => event.sequence)).toEqual([1, 2, 3]);
});

test("fails closed when the mutable run record is ahead of the event log", async () => {
  const { stateRoot, identity, run, runPath } = await fixture();
  const record = JSON.parse(await readFile(runPath, "utf8"));
  await writeFile(runPath, `${JSON.stringify({ ...record, nextSequence: 99 })}\n`);

  await expect(readRun({ stateRoot, identity, runId: run.runId }))
    .rejects.toThrow("run state is ahead of trace");
});
