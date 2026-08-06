import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertBacklogPathsSafe,
  assertGeneratedViewPathsSafe,
} from "../scripts/backlog-policy";

const TEMPORARY_PATHS: string[] = [];

afterEach(async () => {
  await Promise.all(
    TEMPORARY_PATHS.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "riqor-backlog-security-"));
  TEMPORARY_PATHS.push(root);
  await mkdir(join(root, "backlog", "initiatives"), { recursive: true });
  await mkdir(join(root, "backlog", "items"), { recursive: true });
  await mkdir(join(root, "docs", "backlog"), { recursive: true });
  await writeFile(join(root, "BACKLOG.md"), "fixture\n");
  await writeFile(join(root, "docs", "backlog", "CURRENT.md"), "fixture\n");
  return root;
}

describe("backlog filesystem boundaries", () => {
  test("accepts regular repository-local records and generated views", async () => {
    const root = await fixture();
    await writeFile(join(root, "backlog", "initiatives", "RIQ-001-fixture.yml"), "id: RIQ-001\n");
    await writeFile(join(root, "backlog", "items", "RIQ-101-fixture.yml"), "id: RIQ-101\n");
    await expect(assertBacklogPathsSafe(root)).resolves.toBeUndefined();
    await expect(assertGeneratedViewPathsSafe(root)).resolves.toBeUndefined();
  });

  test("rejects symlinked backlog records", async () => {
    const root = await fixture();
    const outside = join(root, "outside.yml");
    await writeFile(outside, "id: outside\n");
    await symlink(outside, join(root, "backlog", "items", "RIQ-101-linked.yml"));
    await expect(assertBacklogPathsSafe(root)).rejects.toThrow("unsafe symlink backlog path");
  });

  test("rejects oversized backlog records", async () => {
    const root = await fixture();
    await writeFile(
      join(root, "backlog", "items", "RIQ-101-large.yml"),
      "x".repeat(128 * 1024 + 1),
    );
    await expect(assertBacklogPathsSafe(root)).rejects.toThrow("backlog file exceeds");
  });

  test("rejects symlinked generated views", async () => {
    const root = await fixture();
    const outside = join(root, "outside.md");
    await writeFile(outside, "outside\n");
    await rm(join(root, "BACKLOG.md"));
    await symlink(outside, join(root, "BACKLOG.md"));
    await expect(assertGeneratedViewPathsSafe(root))
      .rejects.toThrow("unsafe symlink generated view");
  });
});
