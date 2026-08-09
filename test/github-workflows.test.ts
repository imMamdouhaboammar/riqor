import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { verifyActionPins } from "../scripts/verify-action-pins";

const root = resolve(import.meta.dir, "..");

function workflowStepBlocks(content: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const matches = [...content.matchAll(/^ {6}- name: (.+)$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]!;
    const start = match.index!;
    const end = matches[index + 1]?.index ?? content.length;
    blocks.set(match[1]!.trim(), content.slice(start, end));
  }
  return blocks;
}

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

  test("release workflow preserves prerelease channel semantics", async () => {
    const releaseYaml = await readFile(join(root, ".github/workflows/release.yml"), "utf8");
    const steps = workflowStepBlocks(releaseYaml);
    const channel = steps.get("Resolve release channel");
    const versionCheck = steps.get("Verify tag matches package version");
    const publish = steps.get("Publish to npm with trusted publishing");
    const githubRelease = steps.get("Create GitHub Release");

    expect(channel).toContain('npm_tag="${version#*-}"');
    expect(versionCheck).toContain("RELEASE_VERSION: ${{ steps.release-channel.outputs.version }}");
    expect(publish).toContain('npm publish packages/riqor/riqor-*.tgz --access public --tag "${{ steps.release-channel.outputs.npm-tag }}"');
    expect(githubRelease).toContain("prerelease: ${{ steps.release-channel.outputs.prerelease == 'true' }}");
  });

  test("verifyActionPins helper checks workflow SHA pins", async () => {
    await verifyActionPins([
      join(root, ".github/workflows/ci.yml"),
      join(root, ".github/workflows/release.yml"),
    ]);
  });
});
