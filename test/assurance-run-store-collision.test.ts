import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { completeRun, createRun } from "../src/assurance/run-store";
import type { RepositoryIdentity } from "../src/assurance/repository-identity";

test("rejects run id reuse without retrying the protected action", async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), "riqor-run-collision-"));
  const identity: RepositoryIdentity = {
    rootDigest: "d".repeat(64),
    headSha: "e".repeat(40),
    dirty: false,
    rootPath: "/private/collision-project",
  };
  try {
    await createRun({
      stateRoot,
      identity,
      goal: "Original run",
      pathId: "evidence-loop",
      profileId: "standard",
      randomId: () => "fixed-run-id",
    });
    await completeRun({ stateRoot, identity, runId: "fixed-run-id" });

    await expect(createRun({
      stateRoot,
      identity,
      goal: "Reused run",
      pathId: "evidence-loop",
      profileId: "standard",
      randomId: () => "fixed-run-id",
    })).rejects.toThrow("run already exists: fixed-run-id");
  } finally {
    await rm(stateRoot, { recursive: true, force: true });
  }
});
