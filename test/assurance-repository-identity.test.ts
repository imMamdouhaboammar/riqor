import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  inspectRepositoryIdentity,
  normalizeRunGoal,
  resolveRiqorStateRoot,
} from "../src/assurance/repository-identity";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function git(cwd: string, ...args: string[]) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", shell: false });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

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
    const root = await mkdtemp(join(tmpdir(), "riqor-identity-"));
    temporaryPaths.push(root);
    git(root, "init", "-q");
    git(root, "config", "user.email", "test@example.com");
    git(root, "config", "user.name", "Test");
    await writeFile(join(root, "README.md"), "fixture\n");
    git(root, "add", "README.md");
    git(root, "commit", "-qm", "initial");
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

  test("falls back to a canonical non-git directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "riqor-non-git-"));
    temporaryPaths.push(root);
    const identity = await inspectRepositoryIdentity(root);
    expect(identity.rootPath).toBe(root);
    expect(identity.rootDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(identity.headSha).toBeNull();
    expect(identity.dirty).toBe(false);
  });
});
