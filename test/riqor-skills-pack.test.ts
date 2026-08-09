import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildRiqorPackage } from "../scripts/build-riqor-package";

const root = resolve(import.meta.dir, "..");
const packRoot = join(root, "skills", "riqor-pack");
const expectedSkills = ["core", "evidence", "managed-codex", "diagnostics", "security", "release"];

describe("Riqor Skills Pack", () => {
  test("ships a canonical manifest and focused skills", async () => {
    const manifest = JSON.parse(await readFile(join(packRoot, "manifest.json"), "utf8"));
    expect(manifest.name).toBe("riqor-skills-pack");
    expect(manifest.skills).toEqual(expectedSkills);
    for (const skill of expectedSkills) {
      const content = await readFile(join(packRoot, skill, "SKILL.md"), "utf8");
      expect(content).toMatch(/^---\nname: riqor-/);
      expect(content).toContain("description:");
      expect(content).not.toMatch(/sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}/);
    }
  });

  test("includes the canonical skills pack in the npm runtime", async () => {
    await buildRiqorPackage({ repositoryRoot: root });
    const packaged = JSON.parse(await readFile(join(root, "packages", "riqor", "runtime", "skills", "riqor-pack", "manifest.json"), "utf8"));
    expect(packaged.name).toBe("riqor-skills-pack");
    expect(packaged.skills).toEqual(expectedSkills);
  });
});
