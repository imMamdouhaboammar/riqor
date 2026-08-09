import { describe, expect, test } from "bun:test";
import { access, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const sourceRoot = join(root, ".codex", "agents");
const pluginRoot = join(root, "plugins", "riqor");
const skillRoot = join(pluginRoot, "skills");
const pluginAgents = join(pluginRoot, ".codex", "agents");
const publicExcluded = new Set(["security-penetration-tester"]);
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const exists = async (path: string) => { try { await access(path); return true; } catch { return false; } };
const tomls = async (dir: string) => (await readdir(dir)).filter((name) => name.endsWith(".toml")).sort();

describe("agent skill pairing", () => {
  test("exposes only public-safe native specialists as bundled Skills", async () => {
    const sources = await tomls(sourceRoot);
    const publicSlugs = sources.map((name) => name.slice(0, -5)).filter((slug) => !publicExcluded.has(slug));
    const skillDirs = (await readdir(skillRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    const bundledAgents = (await tomls(pluginAgents)).map((name) => name.slice(0, -5));
    expect(sources).toHaveLength(101);
    expect(publicSlugs).toHaveLength(100);
    expect(skillDirs).toHaveLength(112);
    expect(bundledAgents).toHaveLength(100);
    for (const slug of publicSlugs) {
      expect(skillDirs).toContain(slug);
      expect(bundledAgents).toContain(slug);
    }
    for (const slug of publicExcluded) {
      expect(skillDirs).not.toContain(slug);
      expect(bundledAgents).not.toContain(slug);
    }
  });

  test("keeps a deterministic one-to-one mapping and mandatory contract", async () => {
    const mapPath = join(pluginRoot, "agent-skill-map.json");
    expect(await exists(mapPath)).toBe(true);
    if (!(await exists(mapPath))) return;
    const mapping = JSON.parse(await readFile(mapPath, "utf8")) as { pairs: Array<any> };
    expect(mapping.pairs).toHaveLength(100);
    expect(mapping.pairs.some((pair) => pair.slug === "security-penetration-tester")).toBe(false);
    for (const pair of mapping.pairs) {
      const source = Bun.TOML.parse(await readFile(join(root, pair.sourceAgent), "utf8")) as Record<string, unknown>;
      const plugin = Bun.TOML.parse(await readFile(join(root, pair.pluginAgent), "utf8")) as Record<string, unknown>;
      const skill = await readFile(join(root, pair.skill), "utf8");
      const reference = await readFile(join(root, pair.reference), "utf8");
      expect(skill.startsWith(`---\nname: ${pair.slug}\n`), pair.slug).toBe(true);
      expect(skill).toContain("Read `references/agent-instructions.md` before doing the task");
      expect(String(plugin.developer_instructions)).toContain(`Mandatory paired Skill: ${pair.slug}`);
      expect(String(plugin.developer_instructions)).toContain(`$${pair.slug}`);
      expect(reference.trim()).toBe(String(source.developer_instructions ?? "").trim());
      expect(pair.instructionsSha256).toBe(sha256(String(source.developer_instructions ?? "")));
      expect(pair.referenceSha256).toBe(sha256(reference));
      for (const [key, value] of Object.entries(source)) {
        if (key !== "developer_instructions") expect(plugin[key], `${pair.slug}:${key}`).toEqual(value);
      }
    }
  });

  test("riqor-core routes general ChatGPT requests into the specialist catalog", async () => {
    const core = await readFile(join(skillRoot, "riqor-core", "SKILL.md"), "utf8");
    expect(core).toContain("references/specialists.md");
    expect(core).toContain("ChatGPT");
    expect(core).not.toContain("Riqor does not execute inside hosted ChatGPT conversations");
  });

  test("generated catalog is current", () => {
    const run = Bun.spawnSync(["bun", "run", "scripts/generate-agent-skills.ts", "--check"], { cwd: root, stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode, run.stderr.toString()).toBe(0);
  });
});
