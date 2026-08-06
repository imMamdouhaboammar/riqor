import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalSkillDigest, repositorySkillDirectories } from "../scripts/skill-curation-health";

const root = resolve(import.meta.dir, "..");
const skillsRoot = join(root, ".agents", "skills");
const expected = [
  "agency-application-security-engineer",
  "agency-multi-agent-systems-architect",
  "agency-performance-benchmarker",
  "agency-privacy-engineer",
  "agency-secrets-credential-hygiene-engineer",
  "agency-test-automation-engineer",
  "agent-kernel-evolve",
  "architecture-guardian",
  "code-review",
];

const json = async (path: string) => JSON.parse(await readFile(path, "utf8")) as Record<string, any>;

async function installedSkillDirectories() {
  return (await readdir(skillsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

describe("curated external skills", () => {
  test("separates the generated repository skill from the reviewed external allowlist", async () => {
    const lock = await json(join(root, "skills-lock.json"));
    const curation = await json(join(root, "config", "skill-curation.json"));
    const ecc = await json(join(root, ".claude", "ecc-tools.json"));
    const repositorySkills = repositorySkillDirectories(ecc.managedFiles);
    const installed = await installedSkillDirectories();
    const actual = installed.filter((name) => !repositorySkills.includes(name));

    expect(repositorySkills).toEqual(["riqor"]);
    expect(installed).toContain("riqor");
    expect(actual).toEqual(expected);
    expect(Object.keys(lock.skills).sort()).toEqual(expected);

    for (const name of actual) {
      const definition = await readFile(join(skillsRoot, name, "SKILL.md"), "utf8");
      expect(definition.startsWith("---\n")).toBe(true);
      expect(definition).toContain(`name: ${name}`);
      expect(lock.skills[name].computedHash).toMatch(/^[a-f0-9]{64}$/);
      const record = curation.approvedSkills.find((entry: any) => entry.name === name);
      expect(record.upstreamComputedHash).toBe(lock.skills[name].computedHash);
      expect(record.curatedContentHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  test("records the pack, audited source revisions, and curation decisions", async () => {
    const curation = await json(join(root, "config", "skill-curation.json"));
    expect(curation.packUrl).toBe("https://skills.sh/p/Hdo5gpURfnt2T9GG");
    expect(curation.packInstall.status).toBe("source-fallback");
    expect(curation.packInstall.reason).toContain("HTTP 429");
    expect(Object.values(curation.sources).every((source: any) => /^[a-f0-9]{40}$/.test(source.commit))).toBe(true);
    expect(curation.approvedSkills.map((entry: any) => entry.name).sort()).toEqual(expected);
    expect(curation.rejectedSkills.map((entry: any) => entry.name)).toEqual(expect.arrayContaining([
      "agent-kernel",
      "agent-kernel-ops",
      "antigravity-superpowers",
      "agency-reality-checker",
      "agency-test-results-analyzer",
      "agency-workflow-optimizer",
      "aonios-agent",
      "apeiron",
    ]));
    expect(curation.policies).toMatchObject({
      noAutomaticMemoryPublish: true,
      noEnvironmentMutation: true,
      noExternalDelegation: true,
      noProductionLoad: true,
      noSecretRetention: true,
    });
  });

  test("keeps installed curated content aligned with its canonical digest", async () => {
    const lock = await json(join(root, "skills-lock.json"));
    const curation = await json(join(root, "config", "skill-curation.json"));
    for (const name of expected) {
      const record = curation.approvedSkills.find((entry: any) => entry.name === name);
      expect(await canonicalSkillDigest(join(skillsRoot, name))).toBe(record.curatedContentHash);
      expect(record.upstreamComputedHash).toBe(lock.skills[name].computedHash);
    }
  });
});
