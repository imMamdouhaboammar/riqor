import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  inspectRepositoryIdentity,
  normalizeRunGoal,
  resolveRiqorStateRoot,
  type GitRunner,
} from "../src/assurance/repository-identity";
import { runGit } from "./helpers/git";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("assurance repository identity", () => {
  test("normalizes and bounds explicit goals", () => {
    expect(normalizeRunGoal("  Add trace records\n")).toBe("Add trace records");
    expect(() => normalizeRunGoal("   ")).toThrow("goal is required");
    expect(() => normalizeRunGoal("x".repeat(2001))).toThrow("goal exceeds 2000 characters");
    expect(() => normalizeRunGoal("bad\u0000goal")).toThrow("goal contains unsupported control characters");
  });

  test("uses the explicit state root, then XDG state, then the home fallback", () => {
    expect(resolveRiqorStateRoot({ RIQOR_STATE_HOME: "/tmp/explicit", XDG_STATE_HOME: "/tmp/xdg" } as NodeJS.ProcessEnv, "/home/u"))
      .toBe("/tmp/explicit");
    expect(resolveRiqorStateRoot({ XDG_STATE_HOME: "/tmp/xdg" } as NodeJS.ProcessEnv, "/home/u"))
      .toBe("/tmp/xdg/riqor");
    expect(resolveRiqorStateRoot({} as NodeJS.ProcessEnv, "/home/u"))
      .toBe("/home/u/.local/state/riqor");
  });

  test("records a digest and git metadata without serializing the root path", async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), "riqor-identity-")));
    temporaryPaths.push(root);
    runGit(root, "init", "-q");
    runGit(root, "config", "user.email", "test@example.com");
    runGit(root, "config", "user.name", "Test");
    await writeFile(join(root, "README.md"), "fixture\n");
    runGit(root, "add", "README.md");
    runGit(root, "commit", "-qm", "initial");
    await mkdir(join(root, "nested"));

    const identity = await inspectRepositoryIdentity(join(root, "nested"));
    expect(identity.rootDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(identity.headSha).toMatch(/^[a-f0-9]{40}$/);
    expect(identity.dirty).toBe(false);
    expect(identity.rootPath).toBe(root);

    const persistedShape = {
      rootDigest: identity.rootDigest,
      headSha: identity.headSha,
      dirty: identity.dirty,
    };
    expect(JSON.stringify(persistedShape)).not.toContain(root);
  });

  test("preserves leading and trailing spaces in a repository path", async () => {
    const parent = await realpath(await mkdtemp(join(tmpdir(), "riqor-identity-space-")));
    temporaryPaths.push(parent);
    const root = join(parent, " repository with trailing space ");
    await mkdir(root);
    runGit(root, "init", "-q");
    runGit(root, "config", "user.email", "test@example.com");
    runGit(root, "config", "user.name", "Test");
    await writeFile(join(root, "README.md"), "fixture\n");
    runGit(root, "add", "README.md");
    runGit(root, "commit", "-qm", "initial");

    expect((await inspectRepositoryIdentity(root)).rootPath).toBe(root);
  });

  test("fails closed when git status cannot be read", async () => {
    const root = await mkdtemp(join(tmpdir(), "riqor-identity-status-"));
    temporaryPaths.push(root);
    const runner: GitRunner = (_cwd, args) => {
      const command = args.join(" ");
      if (command === "rev-parse --show-toplevel") {
        return { ok: true, stdout: `${root}\n`, stderr: "", timedOut: false };
      }
      if (command === "rev-parse --verify HEAD") {
        return { ok: true, stdout: `${"a".repeat(40)}\n`, stderr: "", timedOut: false };
      }
      return { ok: false, stdout: "", stderr: "status unavailable\n", timedOut: false };
    };

    await expect(inspectRepositoryIdentity(root, { runGit: runner }))
      .rejects.toThrow("git status inspection failed: status unavailable");
  });

  test("falls back to a canonical non-git directory", async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), "riqor-non-git-")));
    temporaryPaths.push(root);
    const identity = await inspectRepositoryIdentity(root);
    expect(identity.rootPath).toBe(root);
    expect(identity.rootDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(identity.headSha).toBeNull();
    expect(identity.dirty).toBe(false);
  });
});
