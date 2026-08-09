import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listWorkflowPaths, verifyActionPins } from "../scripts/verify-action-pins";

describe("GitHub Action pins", () => {
  test("discovers and verifies every repository workflow", async () => {
    const paths = await listWorkflowPaths();
    expect(paths).toEqual([
      ".github/workflows/autodemo.yml",
      ".github/workflows/ci.yml",
      ".github/workflows/dynamic-badges.yml",
      ".github/workflows/release.yml",
    ".github/workflows/reproducibility.yml",
      ".github/workflows/secureai.yml",
    ]);
    await expect(verifyActionPins(paths)).resolves.toBeUndefined();
  });

  test("rejects a floating action reference", async () => {
    const directory = await mkdtemp(join(tmpdir(), "riqor-action-pins-"));
    const workflow = join(directory, "floating.yml");
    await writeFile(workflow, "steps:\n  - uses: actions/checkout@v4\n", "utf8");

    try {
      await expect(verifyActionPins([workflow])).rejects.toThrow("not pinned to a 40-character commit SHA");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
