import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  assertBacklogPathsSafe,
  assertGeneratedViewPathsSafe,
} from "../scripts/backlog-policy";

const ROOT = resolve(import.meta.dir, "..");
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

  test("rejects the reserved sourcePath author field", async () => {
    const root = await fixture();
    await writeFile(
      join(root, "backlog", "items", "RIQ-101-reserved.yml"),
      "id: RIQ-101\nsourcePath: /tmp/forged\n",
    );
    await expect(assertBacklogPathsSafe(root))
      .rejects.toThrow("sourcePath is reserved for internal use");
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

  test("backlog TypeScript sources contain no invalid decoded characters", async () => {
    const invalidDecodedCharacter = /[\u007f-\u009f\ufffd]/;
    for (const filename of [
      "backlog-lib.ts",
      "backlog-policy.ts",
      "backlog-lint.ts",
      "backlog-report.ts",
    ]) {
      const source = await readFile(join(ROOT, "scripts", filename), "utf8");
      expect(source).not.toMatch(invalidDecodedCharacter);
    }
  });
});
