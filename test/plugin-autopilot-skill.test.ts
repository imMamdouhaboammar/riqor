import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(import.meta.dir, "..");
const skillRoot = join(root, "plugins", "riqor", "skills", "chatgpt-codex-plugin-autopilot");
const validator = join(skillRoot, "scripts", "validate_plugin.py");
const packager = join(skillRoot, "scripts", "package_plugin.py");
const temps: string[] = [];

afterEach(async () => Promise.all(temps.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

async function fixture(options: { mcp?: boolean } = {}) {
  const base = await mkdtemp(join(tmpdir(), "plugin-autopilot-"));
  temps.push(base);
  const plugin = join(base, "example-plugin");
  await mkdir(join(plugin, ".codex-plugin"), { recursive: true });
  await mkdir(join(plugin, "skills", "example-skill"), { recursive: true });
  await mkdir(join(plugin, "assets"), { recursive: true });
  const manifest: Record<string, any> = {
    name: "example-plugin",
    version: "1.2.3",
    description: "A small example plugin",
    author: { name: "Example Dev" },
    skills: "./skills/",
    interface: {
      displayName: "Example Plugin",
      shortDescription: "Useful workflows",
      longDescription: "A valid plugin fixture for deterministic validation and packaging.",
      developerName: "Example Dev",
      category: "Developer Tools",
      capabilities: ["Example workflow"],
      websiteURL: "https://example.com",
      privacyPolicyURL: "https://example.com/privacy",
      termsOfServiceURL: "https://example.com/terms",
      supportURL: "https://example.com/support",
      logo: "./assets/mark.svg",
      composerIcon: "./assets/mark.svg",
    },
  };
  if (options.mcp) {
    manifest.mcpServers = "./.mcp.json";
    await writeFile(join(plugin, ".mcp.json"), JSON.stringify({ example: { command: "example-server" } }));
  }
  await writeFile(join(plugin, ".codex-plugin", "plugin.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(join(plugin, "skills", "example-skill", "SKILL.md"), "---\nname: example-skill\ndescription: Use when the user needs the example workflow.\n---\n\n# Example\n\nDo the example workflow.\n");
  await writeFile(join(plugin, "assets", "mark.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64"/></svg>\n');
  return plugin;
}

function runPython(script: string, args: string[]) {
  return Bun.spawnSync(["python3", script, ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
}

function output(run: ReturnType<typeof Bun.spawnSync>) {
  return `${run.stdout.toString()}\n${run.stderr.toString()}`;
}

describe("generic ChatGPT/Codex plugin autopilot Skill", () => {
  test("ships a generic full-autopilot workflow with progressive references", async () => {
    const definition = await readFile(join(skillRoot, "SKILL.md"), "utf8");
    expect(definition).toContain("name: chatgpt-codex-plugin-autopilot");
    expect(definition).toContain("official OpenAI");
    expect(definition).toContain("skills-only");
    expect(definition).toContain("MCP-backed");
    expect(definition).toContain("Full Autopilot Publish");
    expect(definition).toContain("public-distribution");
    expect(definition).not.toContain("/Users/");
    for (const name of ["official-contract.md", "architectures.md", "release-playbook.md", "submission-errors.md"]) {
      expect((await readFile(join(skillRoot, "references", name), "utf8")).length).toBeGreaterThan(300);
    }
  });

  test("validates a final-directory compliant skills-only plugin", async () => {
    const plugin = await fixture();
    const run = runPython(validator, [plugin, "--json"]);
    expect(run.exitCode, output(run)).toBe(0);
    const report = JSON.parse(run.stdout.toString());
    expect(report.ok).toBe(true);
    expect(report.architecture).toBe("skills-only");
    expect(report.skills).toEqual(["example-skill"]);
  });

  test("rejects final-directory metadata overflow and non-square branding", async () => {
    const plugin = await fixture();
    const manifestPath = join(plugin, ".codex-plugin", "plugin.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.interface.displayName = "X".repeat(31);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await writeFile(join(plugin, "assets", "mark.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"/>');
    const run = runPython(validator, [plugin, "--json"]);
    expect(run.exitCode).not.toBe(0);
    expect(output(run)).toContain("displayName");
    expect(output(run)).toContain("square");
  });

  test("requires all public listing URLs for MCP-backed plugins", async () => {
    const plugin = await fixture({ mcp: true });
    const manifestPath = join(plugin, ".codex-plugin", "plugin.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    delete manifest.interface.supportURL;
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    const run = runPython(validator, [plugin, "--json"]);
    expect(run.exitCode).not.toBe(0);
    expect(output(run)).toContain("supportURL");
  });

  test("fails closed on symlinks and stale public exclusions", async () => {
    const plugin = await fixture();
    await symlink(join(plugin, "assets", "mark.svg"), join(plugin, "skills", "example-skill", "linked.svg"));
    await mkdir(join(plugin, "skills", "security-penetration-tester"), { recursive: true });
    await writeFile(join(plugin, "skills", "security-penetration-tester", "SKILL.md"), "---\nname: security-penetration-tester\ndescription: rejected public skill\n---\n");
    const run = runPython(validator, [plugin, "--json", "--exclude", "security-penetration-tester"]);
    expect(run.exitCode).not.toBe(0);
    expect(output(run)).toContain("symlink");
    expect(output(run)).toContain("public exclusion");
  });


  test("rejects non-canonical component paths and unsafe author URLs", async () => {
    const plugin = await fixture();
    const manifestPath = join(plugin, ".codex-plugin", "plugin.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.skills = "skills/";
    manifest.interface.logo = "assets/mark.svg";
    manifest.author.url = "https://user:pass@example.com";
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    const run = runPython(validator, [plugin, "--json"]);
    expect(run.exitCode).not.toBe(0);
    expect(output(run)).toContain("skills path");
    expect(output(run)).toContain("logo");
    expect(output(run)).toContain("author.url");
  });

  test("rejects final starter-prompt and brand-color violations", async () => {
    const plugin = await fixture();
    const manifestPath = join(plugin, ".codex-plugin", "plugin.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.interface.defaultPrompt = ["Use @bad-app now", "same prompt", "  same   prompt  ", "fourth"];
    manifest.interface.brandColor = "#FFFFFF";
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    const run = runPython(validator, [plugin, "--json"]);
    expect(run.exitCode).not.toBe(0);
    expect(output(run)).toContain("defaultPrompt");
    expect(output(run)).toContain("brandColor");
  });

  test("rejects deep and whitespace archive paths plus empty skill bodies", async () => {
    const plugin = await fixture();
    await writeFile(join(plugin, " leading.txt"), "bad");
    let deep = plugin;
    for (let index = 0; index < 20; index++) deep = join(deep, `d${index}`);
    await mkdir(deep, { recursive: true });
    await writeFile(join(deep, "file.txt"), "deep");
    await writeFile(join(plugin, "skills", "example-skill", "SKILL.md"), "---\nname: example-skill\ndescription: Use when needed.\n---\n");
    const run = runPython(validator, [plugin, "--json"]);
    expect(run.exitCode).not.toBe(0);
    expect(output(run)).toContain("outer whitespace");
    expect(output(run)).toContain("20 segments");
    expect(output(run)).toContain("body");
  });


  test("enforces the 100 MB compressed archive ceiling", () => {
    const code = `import importlib.util; p=${JSON.stringify(packager)}; s=importlib.util.spec_from_file_location('pkg',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(m.archive_size_within_limit(100_000_000)); print(m.archive_size_within_limit(100_000_001))`;
    const run = Bun.spawnSync(["python3", "-c", code], { cwd: root, stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode, output(run)).toBe(0);
    expect(run.stdout.toString().trim().split("\n")).toEqual(["True", "False"]);
  });

  test("packages byte-identical archive-root ZIPs and preserves validation", async () => {
    const plugin = await fixture();
    const first = join(plugin, "..", "first.zip");
    const second = join(plugin, "..", "second.zip");
    const one = runPython(packager, [plugin, first, "--json"]);
    const two = runPython(packager, [plugin, second, "--json"]);
    expect(one.exitCode, output(one)).toBe(0);
    expect(two.exitCode, output(two)).toBe(0);
    const a = createHash("sha256").update(await readFile(first)).digest("hex");
    const b = createHash("sha256").update(await readFile(second)).digest("hex");
    expect(a).toBe(b);
    const listing = Bun.spawnSync(["unzip", "-Z1", first], { stdout: "pipe", stderr: "pipe" });
    expect(listing.exitCode).toBe(0);
    const entries = listing.stdout.toString().trim().split("\n");
    expect(entries[0]).toBe(".codex-plugin/");
    expect(entries).toContain(".codex-plugin/plugin.json");
    expect(entries).toContain("skills/example-skill/SKILL.md");
    expect(entries.some((entry) => entry.startsWith("example-plugin/"))).toBe(false);
  });
});
