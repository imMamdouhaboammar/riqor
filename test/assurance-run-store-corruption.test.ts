import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRun, readRun } from "../src/assurance/run-store";
import type { RepositoryIdentity } from "../src/assurance/repository-identity";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function fixture() {
  const stateRoot = await mkdtemp(join(tmpdir(), "riqor-run-corruption-"));
  temporaryPaths.push(stateRoot);
  const identity: RepositoryIdentity = {
    rootDigest: "1".repeat(64),
    headSha: "2".repeat(40),
    dirty: false,
    rootPath: "/private/corruption-project",
  };
  await createRun({
    stateRoot,
    identity,
    goal: "Reject corrupted records",
    pathId: "evidence-loop",
    profileId: "assured",
    randomId: () => "corrupt-run",
  });
  const runPath = join(
    stateRoot,
    "projects",
    identity.rootDigest,
    "runs",
    "corrupt-run",
    "run.json",
  );
  return { stateRoot, identity, runPath };
}

test("rejects unknown profile and status values from persisted run state", async () => {
  const { stateRoot, identity, runPath } = await fixture();
  const original = JSON.parse(await readFile(runPath, "utf8"));

  await writeFile(runPath, `${JSON.stringify({ ...original, profileId: "turbo" })}\n`);
  await expect(readRun({ stateRoot, identity, runId: "corrupt-run" }))
    .rejects.toThrow("invalid run record");

  await writeFile(runPath, `${JSON.stringify({ ...original, status: "pretend-complete" })}\n`);
  await expect(readRun({ stateRoot, identity, runId: "corrupt-run" }))
    .rejects.toThrow("invalid run record");
});

test("rejects malformed repository metadata and timestamps", async () => {
  const { stateRoot, identity, runPath } = await fixture();
  const original = JSON.parse(await readFile(runPath, "utf8"));

  await writeFile(runPath, `${JSON.stringify({
    ...original,
    repository: { ...original.repository, headSha: "not-a-sha" },
  })}\n`);
  await expect(readRun({ stateRoot, identity, runId: "corrupt-run" }))
    .rejects.toThrow("invalid run record");

  await writeFile(runPath, `${JSON.stringify({ ...original, updatedAt: "not-a-date" })}\n`);
  await expect(readRun({ stateRoot, identity, runId: "corrupt-run" }))
    .rejects.toThrow("invalid run timestamp");
});
