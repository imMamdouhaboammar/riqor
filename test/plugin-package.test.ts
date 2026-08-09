import { describe, expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isCredentialShapedPluginPath } from "../scripts/plugin-health";

const root = resolve(import.meta.dir, "..");
const plugin = join(root, "plugins", "riqor");

async function json(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, any>;
}

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await filesBelow(path));
    else paths.push(path);
  }
  return paths;
}

describe("plugin package", () => {
  test("uses a valid bounded Codex manifest", async () => {
    const manifest = await json(join(plugin, ".codex-plugin", "plugin.json"));
    expect(manifest.name).toBe("riqor");
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
    expect(manifest.description).toBeString();
    expect(manifest.author?.name).toBeString();
    expect(manifest.skills).toBe("./skills/");
    expect(manifest.hooks).toBeUndefined();
    expect(manifest.interface?.category).toBe("Developer Tools");
    expect(manifest.interface?.defaultPrompt).toHaveLength(3);
  });

  test("discovers lifecycle hooks from the default plugin path", async () => {
    const hooks = await json(join(plugin, "hooks", "hooks.json"));
    expect(hooks.hooks.SessionStart).toBeArray();
    expect(hooks.hooks.UserPromptSubmit).toBeArray();
    expect(hooks.hooks.PostToolUse).toBeArray();
    expect(hooks.hooks.Stop).toBeArray();
    const serialized = JSON.stringify(hooks);
    expect(serialized).toContain("${PLUGIN_ROOT}/hooks/main.mjs");
    expect(serialized).not.toContain("bun ");
    expect(serialized).not.toContain("/Users/");
    expect((await readFile(join(plugin, "hooks", "main.mjs"), "utf8")).length).toBeGreaterThan(1000);
  });

  test("publishes through the repository-local marketplace", async () => {
    const marketplace = await json(join(root, ".agents", "plugins", "marketplace.json"));
    expect(marketplace.name).toBe("riqor");
    const entry = marketplace.plugins.find((candidate: any) => candidate.name === "riqor");
    expect(entry.source).toEqual({ source: "local", path: "./plugins/riqor" });
    expect(entry.policy).toEqual({ installation: "AVAILABLE", authentication: "ON_INSTALL" });
    expect(entry.category).toBe("Developer Tools");
  });

  test("ships only bounded plugin assets and no credential-shaped files", async () => {
    const paths = (await filesBelow(plugin)).map((path) => path.slice(plugin.length + 1));
    expect(paths.some(isCredentialShapedPluginPath)).toBe(false);
    expect(paths.some((path) => path.startsWith("fixtures/"))).toBe(false);
    expect(paths.some((path) => path.startsWith(".runs/"))).toBe(false);
  });

  test("credential filename exemption is limited to native agent TOML files", () => {
    expect(isCredentialShapedPluginPath(".codex/agents/security-secrets-credential-engineer.toml")).toBe(false);
    expect(isCredentialShapedPluginPath("secrets.txt")).toBe(true);
    expect(isCredentialShapedPluginPath("config/credentials.json")).toBe(true);
    expect(isCredentialShapedPluginPath(".codex/agents/secret.txt")).toBe(true);
  });

  test("skills have complete frontmatter", async () => {
    for (const name of ["self-improvement-loop", "evidence-engineering", "harness-paths", "universal-session-runtime"]) {
      const definition = await readFile(join(plugin, "skills", name, "SKILL.md"), "utf8");
      expect(definition.startsWith("---\n")).toBe(true);
      expect(definition).toContain(`name: ${name}`);
      expect(definition).toMatch(/description: .+/);
      expect(definition).not.toContain("TODO");
    }
  });
});
