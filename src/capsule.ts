import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { classifyPrompt } from "../plugins/codex-self-improvement/hooks/router";
import { harnessPathForProfile, type HarnessPath, type TaskProfile } from "../plugins/codex-self-improvement/hooks/paths";

export type Capability = { name: string; path: string };
export type { TaskProfile } from "../plugins/codex-self-improvement/hooks/paths";

const globalSkillRoot = join(homedir(), ".agents", "skills");
const projectSkillRoot = resolve(import.meta.dir, "..", ".agents", "skills");
const registry: Record<TaskProfile, string[]> = {
  database: ["postgresql-table-design"],
  review: ["verification-before-completion"],
  debugging: ["systematic-debugging", "test-driven-development"],
  security: ["verification-before-completion"],
  ui: ["test-driven-development"],
  research: ["verification-before-completion"],
  privacy: ["verification-before-completion"],
  performance: ["verification-before-completion"],
  evolution: ["verification-before-completion"],
  engineering: ["test-driven-development", "clean-code-guard", "test-guard"],
};

export function classifyTask(task: string): TaskProfile {
  return classifyPrompt(task).profile;
}

export function selectedHarnessPath(task: string): HarnessPath {
  return harnessPathForProfile(classifyTask(task));
}

export function selectedCapabilities(task: string, selectedPath = selectedHarnessPath(task)): Capability[] {
  const profile = classifyTask(task);
  const names = [...new Set([...registry[profile], ...selectedPath.curatedSkills])];
  const curated = new Set(selectedPath.curatedSkills);
  return names.map((name) => ({
    name,
    path: join(curated.has(name) ? projectSkillRoot : globalSkillRoot, name),
  }));
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

const sentenceCase = (value: string) => value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`;

function minimalInstructions(path: HarnessPath) {
  return `# Task-scoped Codex execution

Harness path: ${path.id}
Objective: ${path.objective}

Evidence required:
${path.evidence.map((entry) => `- ${sentenceCase(entry)}`).join("\n")}

Guardrails:
${path.guardrails.map((entry) => `- ${sentenceCase(entry)}`).join("\n")}

Actions requiring explicit approval:
${path.requiresExplicitApproval.map((entry) => `- ${sentenceCase(entry)}`).join("\n")}

Define observable success, inspect relevant files and callers, and use only the installed skills visible in this capsule when they apply. Make the smallest root-cause change. Preserve unrelated files and secrets. Run a focused check after the final mutation. Finish with changed files, checks and outcomes, and anything not verified. Never claim completion from a plan, diff, or prior agent report.
`;
}

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

export async function createCapsule(input: { authPath: string; capabilities: Capability[]; path?: HarnessPath }) {
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
    await writeFile(join(capsule, "AGENTS.md"), minimalInstructions(input.path ?? harnessPathForProfile("debugging")), { mode: 0o600 });
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
