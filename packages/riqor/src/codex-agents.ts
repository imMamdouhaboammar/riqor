import { access, cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const profileMarker = "# Managed by Riqor\n";
const agentsMarker = ".riqor-managed";

async function exists(path: string) {
  try { await access(path); return true; } catch { return false; }
}

export function hasExplicitCodexProfile(args: readonly string[]) {
  for (const arg of args) {
    if (arg === "--") break;
    if (arg === "-p" || arg === "--profile" || arg.startsWith("--profile=")) return true;
  }
  return false;
}

export function withRiqorCodexProfile(args: readonly string[]) {
  return hasExplicitCodexProfile(args) ? [...args] : ["-p", "riqor", ...args];
}

export async function installRiqorAgentProfile(input: { codexHome: string; sourceCodexDir: string }) {
  const codexHome = resolve(input.codexHome);
  const source = resolve(input.sourceCodexDir);
  const profilePath = join(codexHome, "riqor.config.toml");
  const agentsDir = join(codexHome, "riqor-agents");
  const profileExists = await exists(profilePath);
  const agentsExist = await exists(agentsDir);
  const managedProfile = !profileExists || (await readFile(profilePath, "utf8")).startsWith(profileMarker);
  const managedAgents = !agentsExist || await exists(join(agentsDir, agentsMarker));
  if (!managedProfile || !managedAgents) {
    return { ok: false, agentCount: 0, profilePath, agentsDir, error: "foreign Codex agent profile paths preserved" };
  }

  const sourceAgents = join(source, "agents");
  const sourceProfile = await readFile(join(source, "riqor.config.toml"), "utf8");
  if (/\[(?:mcp_servers|apps|tools)(?:\.|\])/m.test(sourceProfile)) throw new Error("Riqor agent profile must not configure tools, apps, or MCP servers");
  const files = (await readdir(sourceAgents)).filter((name) => name.endsWith(".toml")).sort();
  const staging = join(codexHome, `.riqor-agents-${randomUUID()}`);
  const tempProfile = join(codexHome, `.riqor-profile-${randomUUID()}.toml`);
  await mkdir(codexHome, { recursive: true, mode: 0o700 });
  try {
    await cp(sourceAgents, staging, { recursive: true });
    await writeFile(join(staging, agentsMarker), profileMarker, { mode: 0o600 });
    const installedProfile = profileMarker + sourceProfile.replaceAll('config_file = "agents/', 'config_file = "riqor-agents/');
    await writeFile(tempProfile, installedProfile, { mode: 0o600 });
    if (agentsExist) await rm(agentsDir, { recursive: true, force: true });
    await rename(staging, agentsDir);
    if (profileExists) await rm(profilePath, { force: true });
    await rename(tempProfile, profilePath);
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(tempProfile, { force: true });
  }
  return { ok: true, agentCount: files.length, profilePath, agentsDir };
}

export async function uninstallRiqorAgentProfile(input: { codexHome: string }) {
  const codexHome = resolve(input.codexHome);
  const profilePath = join(codexHome, "riqor.config.toml");
  const agentsDir = join(codexHome, "riqor-agents");
  const removed: string[] = [];
  const preserved: string[] = [];
  if (await exists(profilePath)) {
    const managed = (await readFile(profilePath, "utf8")).startsWith(profileMarker);
    if (managed) { await rm(profilePath, { force: true }); removed.push(profilePath); }
    else preserved.push(profilePath);
  }
  if (await exists(agentsDir)) {
    if (await exists(join(agentsDir, agentsMarker))) { await rm(agentsDir, { recursive: true, force: true }); removed.push(agentsDir); }
    else preserved.push(agentsDir);
  }
  return { ok: preserved.length === 0, removed, preserved };
}
