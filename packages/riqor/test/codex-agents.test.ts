import { afterEach, describe, expect, test } from "bun:test";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installRiqorAgentProfile, uninstallRiqorAgentProfile, withRiqorCodexProfile } from "../src/codex-agents";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("native Codex agents", () => {
  test("riqor codex uses the managed profile unless the user selected another profile", () => {
    expect(withRiqorCodexProfile(["exec", "fix it"])).toEqual(["-p", "riqor", "exec", "fix it"]);
    expect(withRiqorCodexProfile(["-p", "custom", "exec", "fix it"])).toEqual(["-p", "custom", "exec", "fix it"]);
    expect(withRiqorCodexProfile(["--profile=custom", "fix it"])).toEqual(["--profile=custom", "fix it"]);
    expect(withRiqorCodexProfile(["--", "--profile", "prompt text"])).toEqual(["-p", "riqor", "--", "--profile", "prompt text"]);
  });

  test("install copies native agents and creates an agent-only managed profile", async () => {
    const home = await mkdtemp(join(tmpdir(), "riqor-agents-")); roots.push(home);
    const source = join(home, "source"); const codexHome = join(home, ".codex");
    await mkdir(join(source, "agents"), { recursive: true });
    await writeFile(join(source, "agents", "reviewer.toml"), 'developer_instructions = "Review"\n');
    await writeFile(join(source, "riqor.config.toml"), '[features]\nmulti_agent = true\n[agents]\nenabled = true\n[agents.reviewer]\ndescription = "Review"\nconfig_file = "agents/reviewer.toml"\n');
    const result = await installRiqorAgentProfile({ codexHome, sourceCodexDir: source });
    expect(result.ok).toBe(true); expect(result.agentCount).toBe(1);
    expect(await readFile(join(codexHome, "riqor-agents", "reviewer.toml"), "utf8")).toContain("Review");
    const profile = await readFile(join(codexHome, "riqor.config.toml"), "utf8");
    expect(profile).toStartWith("# Managed by Riqor\n");
    expect(profile).toContain('config_file = "riqor-agents/reviewer.toml"');
    expect(profile).not.toContain("mcp_servers");
  });

  test("uninstall preserves foreign Codex profile paths", async () => {
    const home = await mkdtemp(join(tmpdir(), "riqor-agents-foreign-")); roots.push(home);
    const codexHome = join(home, ".codex"); await mkdir(join(codexHome, "riqor-agents"), { recursive: true });
    await writeFile(join(codexHome, "riqor.config.toml"), "# user profile\n");
    await writeFile(join(codexHome, "riqor-agents", "custom.toml"), "# user agent\n");
    const result = await uninstallRiqorAgentProfile({ codexHome });
    expect(result.ok).toBe(false); expect(result.preserved).toHaveLength(2);
    await access(join(codexHome, "riqor.config.toml")); await access(join(codexHome, "riqor-agents", "custom.toml"));
  });
});
