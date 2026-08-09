import { describe, expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const sourceAgents = join(root, ".codex", "agents");
const pluginCodex = join(root, "plugins", "riqor", ".codex");
const publicExcluded = new Set(["security-penetration-tester.toml"]);

async function tomlFiles(dir: string) {
  return (await readdir(dir)).filter((name) => name.endsWith(".toml")).sort();
}

describe("native Codex agent bundle", () => {
  test("every source agent is valid TOML", async () => {
    const files = await tomlFiles(sourceAgents);
    expect(files.length).toBe(101);
    for (const file of files) {
      const content = await readFile(join(sourceAgents, file), "utf8");
      expect(() => Bun.TOML.parse(content), file).not.toThrow();
    }
  });

  test("plugin preserves native config and injects mandatory paired Skills", async () => {
    const source = await tomlFiles(sourceAgents);
    const publicSource = source.filter((file) => !publicExcluded.has(file));
    const bundled = await tomlFiles(join(pluginCodex, "agents"));
    expect(bundled).toEqual(publicSource);
    expect(bundled).not.toContain("security-penetration-tester.toml");
    for (const file of publicSource) {
      const slug = file.slice(0, -5);
      const canonical = Bun.TOML.parse(await readFile(join(sourceAgents, file), "utf8")) as Record<string, unknown>;
      const packaged = Bun.TOML.parse(await readFile(join(pluginCodex, "agents", file), "utf8")) as Record<string, unknown>;
      for (const [key, value] of Object.entries(canonical)) {
        if (key !== "developer_instructions") expect(packaged[key], `${slug}:${key}`).toEqual(value);
      }
      expect(String(packaged.developer_instructions)).toStartWith(String(canonical.developer_instructions ?? "").trimEnd());
      expect(String(packaged.developer_instructions)).toContain(`Mandatory paired Skill: ${slug}`);
      expect(String(packaged.developer_instructions)).toContain(`$${slug}`);
    }
  });

  test("agent profile registers all roles without adding tools or apps", async () => {
    const profile = Bun.TOML.parse(await readFile(join(pluginCodex, "riqor.config.toml"), "utf8")) as any;
    expect(profile.features?.multi_agent).toBe(true);
    expect(profile.agents?.enabled).toBe(true);
    expect(profile.agents?.max_concurrent_threads_per_session).toBe(6);
    expect(profile.mcp_servers).toBeUndefined();
    expect(profile.apps).toBeUndefined();
    expect(profile.tools).toBeUndefined();
    const reserved = new Set(["enabled", "max_concurrent_threads_per_session", "max_depth"]);
    const roles = Object.entries(profile.agents).filter(([key]) => !reserved.has(key));
    expect(roles).toHaveLength(100);
    expect(profile.agents?.["security-penetration-tester"]).toBeUndefined();
    for (const [name, value] of roles as Array<[string, any]>) {
      expect(value.description, name).toBeString();
      expect(value.config_file, name).toBe(`agents/${name}.toml`);
    }
  });
});
