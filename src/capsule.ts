import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

export type Capability = { name: string; path: string };
export type TaskProfile = "database" | "review" | "debugging" | "engineering";

const skillRoot = join(homedir(), ".agents", "skills");
const registry: Record<TaskProfile, string[]> = {
  database: ["postgresql-table-design"],
  review: ["verification-before-completion"],
  debugging: ["systematic-debugging", "test-driven-development"],
  engineering: ["test-driven-development", "clean-code-guard", "test-guard"],
};

export function classifyTask(task: string): TaskProfile {
  if (/postgres|schema|foreign key|index|row.level|\brls\b/i.test(task)) return "database";
  if (/review|audit|completion claim|verdict/i.test(task)) return "review";
  if (/bug|failure|wrong|intermittent|root cause/i.test(task)) return "debugging";
  return "engineering";
}

export function selectedCapabilities(task: string): Capability[] {
  return registry[classifyTask(task)].map((name) => ({ name, path: join(skillRoot, name) }));
}

const minimalConfig = `model = "gpt-5.6-sol"
model_reasoning_effort = "high"
approval_policy = "never"
web_search = "disabled"

[features]
plugins = false
apps = false
hooks = false
memories = false
goals = false
shell_tool = true
unified_exec = true

[shell_environment_policy]
inherit = "all"
ignore_default_excludes = false
exclude = []
include_only = []
experimental_use_profile = false
`;

const minimalInstructions = `# Task-scoped Codex execution

Define observable success, inspect relevant files and callers, and use only the installed skills visible in this capsule when they apply. Make the smallest root-cause change. Preserve unrelated files and secrets. Run a focused check after changes. Finish with changed files, checks and outcomes, and anything not verified. Never claim completion from a plan, diff, or prior agent report.
`;

async function validateCapability(capability: Capability) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(capability.name)) throw new Error("invalid capability name");
  const directory = await lstat(capability.path);
  if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error(`invalid capability: ${capability.name}`);
  const definition = await readFile(join(capability.path, "SKILL.md"), "utf8");
  if (!definition.startsWith("---\n")) throw new Error(`invalid capability definition: ${capability.name}`);
}

async function validateAuth(authPath: string) {
  try {
    const auth = await lstat(authPath);
    if (!auth.isFile() || auth.isSymbolicLink() || (auth.mode & 0o077) !== 0) throw new Error("unsafe auth file");
  } catch (error) {
    throw new Error("invalid auth file", { cause: error });
  }
}

export async function createCapsule(input: { authPath: string; capabilities: Capability[] }) {
  await validateAuth(input.authPath);
  const capsule = await mkdtemp(join(tmpdir(), "codex-capability-capsule-"));
  try {
    await chmod(capsule, 0o700);
    await mkdir(join(capsule, "skills"), { mode: 0o700 });
    await symlink(input.authPath, join(capsule, "auth.json"));
    for (const capability of input.capabilities) {
      await validateCapability(capability);
      await symlink(capability.path, join(capsule, "skills", capability.name), "dir");
    }
    await writeFile(join(capsule, "config.toml"), minimalConfig, { mode: 0o600 });
    await writeFile(join(capsule, "AGENTS.md"), minimalInstructions, { mode: 0o600 });
    return capsule;
  } catch (error) {
    await rm(capsule, { recursive: true, force: true });
    throw error;
  }
}

export async function destroyCapsule(capsule: string) {
  const prefix = `${resolve(tmpdir())}/codex-capability-capsule-`;
  if (!resolve(capsule).startsWith(prefix)) throw new Error("refusing to remove a non-capsule path");
  await rm(capsule, { recursive: true, force: true });
}
