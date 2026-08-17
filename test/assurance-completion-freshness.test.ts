import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendRunEvent,
  completeRun,
  createRun,
  transitionRun,
} from "../src/assurance/run-store";
import type { RepositoryIdentity } from "../src/assurance/repository-identity";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function fixture() {
  const stateRoot = await mkdtemp(join(tmpdir(), "riqor-completion-freshness-"));
  temporaryPaths.push(stateRoot);
  const identity: RepositoryIdentity = {
    rootDigest: "a".repeat(64),
    headSha: "b".repeat(40),
    dirty: false,
    rootPath: "/private/project-that-must-not-be-persisted",
  };
  await createRun({
    stateRoot,
    identity,
    goal: "Prove completion freshness",
    pathId: "evidence-loop",
    profileId: "assured",
    randomId: () => "run-freshness",
  });
  return { stateRoot, identity, runId: "run-freshness" };
}

async function recordMutation(options: Awaited<ReturnType<typeof fixture>>) {
  await appendRunEvent({
    stateRoot: options.stateRoot,
    identity: options.identity,
    runId: options.runId,
    source: "terminal",
    type: "workspace_mutated",
    status: "success",
    digest: "c".repeat(64),
    nextStatus: "verification-pending",
  });
}

async function recordVerification(
  options: Awaited<ReturnType<typeof fixture>>,
  metadata: Readonly<Record<string, string | number | boolean | null>>,
) {
  await appendRunEvent({
    stateRoot: options.stateRoot,
    identity: options.identity,
    runId: options.runId,
    source: "terminal",
    type: "verification_completed",
    status: "success",
    digest: "d".repeat(64),
    metadata,
    whenStatus: "verification-pending",
    nextStatus: "active",
  });
}

describe("assurance completion freshness", () => {
  test("does not let a manual status transition substitute for verification evidence", async () => {
    const options = await fixture();
    await recordMutation(options);
    await transitionRun({
      stateRoot: options.stateRoot,
      identity: options.identity,
      runId: options.runId,
      status: "active",
    });

    await expect(completeRun(options)).rejects.toThrow("successful verification evidence");
  });

  test("blocks completion when verification provenance could not inspect the repository", async () => {
    const options = await fixture();
    await recordMutation(options);
    await recordVerification(options, { repositoryInspection: "unavailable" });

    await expect(completeRun(options)).rejects.toThrow("repository provenance");
  });

  test("blocks completion when HEAD changed after successful verification", async () => {
    const options = await fixture();
    await recordMutation(options);
    await recordVerification(options, {
      repositoryHead: options.identity.headSha,
      repositoryDirty: options.identity.dirty,
    });

    const changedIdentity: RepositoryIdentity = {
      ...options.identity,
      headSha: "e".repeat(40),
    };
    await expect(completeRun({
      stateRoot: options.stateRoot,
      identity: changedIdentity,
      runId: options.runId,
    })).rejects.toThrow("repository changed after verification");
  });

  test("allows completion when the latest verification covers the current repository identity", async () => {
    const options = await fixture();
    await recordMutation(options);
    await recordVerification(options, {
      repositoryHead: options.identity.headSha,
      repositoryDirty: options.identity.dirty,
    });

    const completed = await completeRun(options);
    expect(completed.status).toBe("completed");
  });
});
