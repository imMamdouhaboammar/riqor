import { describe, expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
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

  test("all workflows enforce local terminal npm publishing policy", async () => {
    const workflowDir = join(root, ".github", "workflows");
    for (const name of await readdir(workflowDir)) {
      if (!/\.ya?ml$/.test(name)) continue;
      const workflow = await readFile(join(workflowDir, name), "utf8");
      expect(workflow).not.toMatch(/(^|\s)npm\s+publish(\s|$)/m);
      expect(workflow).not.toMatch(/(^|\s)bun\s+publish(\s|$)/m);
      expect(workflow).not.toContain("NODE_AUTH_TOKEN");
      expect(workflow).not.toContain("NPM_TOKEN");
      expect(workflow).not.toContain(`registry-url: "https://registry.npmjs.org"`);
    }

    const releaseYaml = await readFile(join(workflowDir, "release.yml"), "utf8");
    expect(releaseYaml).toContain("permissions:\n  contents: write");
    expect(releaseYaml).not.toContain("id-token: write");
    expect(releaseYaml).toContain("Automated package deployment to the registry is disabled");
  });

  test("release workflow preserves prerelease channel semantics", async () => {
    const releaseYaml = await readFile(join(root, ".github/workflows/release.yml"), "utf8");
    const steps = workflowStepBlocks(releaseYaml);
    const channel = steps.get("Resolve release channel");
    const versionCheck = steps.get("Verify tag matches package version");
    const registryCompare = steps.get("Fetch and compare published npm tarball");
    const githubRelease = steps.get("Create GitHub Release");

    expect(channel).toContain('npm_tag="${version#*-}"');
    expect(versionCheck).toContain("RELEASE_VERSION: ${{ steps.release-channel.outputs.version }}");
    expect(registryCompare).toContain('npm pack "riqor@${RELEASE_VERSION}"');
    expect(registryCompare).toContain('cmp -- "${built[0]}" "${registry[0]}"');
    expect(githubRelease).toContain("dist/npm-registry/riqor-*.tgz");
    expect(githubRelease).toContain("prerelease: ${{ steps.release-channel.outputs.prerelease == 'true' }}");
  });

  test("verifyActionPins helper checks workflow SHA pins", async () => {
    await verifyActionPins([
      join(root, ".github/workflows/ci.yml"),
      join(root, ".github/workflows/release.yml"),
    ]);
  });
});
