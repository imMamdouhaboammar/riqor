import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { verifyActionPins } from "../scripts/verify-action-pins";

const root = resolve(import.meta.dir, "..");

describe("GitHub Workflow security", () => {
  test("workflows use pinned commit SHAs and explicit permissions", async () => {
    for (const file of [".github/workflows/ci.yml", ".github/workflows/release.yml"]) {
      const path = join(root, file);
      const content = await readFile(path, "utf8");
      expect(content).not.toMatch(/uses:\s+[^\s]+@(v\d+|main|master)\b/);
      expect(content).not.toContain("permissions: write-all");
    }
  });

  test("CI supports an explicit manual verification run", async () => {
    const ciYaml = await readFile(join(root, ".github/workflows/ci.yml"), "utf8");
    expect(ciYaml).toMatch(/^\s{2}workflow_dispatch:\s*$/m);
  });

  test("release workflow specifies strict publish permissions and environment", async () => {
    const releaseYaml = await readFile(join(root, ".github/workflows/release.yml"), "utf8");
    expect(releaseYaml).toContain("permissions:\n  contents: write\n  id-token: write");
    expect(releaseYaml).toContain("environment: npm");
    expect(releaseYaml).toContain("npm install --global npm@11.18.0");
    expect(releaseYaml).not.toContain("NODE_AUTH_TOKEN");
  });

  test("verifyActionPins helper checks workflow SHA pins", async () => {
    await verifyActionPins([
      join(root, ".github/workflows/ci.yml"),
      join(root, ".github/workflows/release.yml"),
    ]);
  });
});
