import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

export type PluginHealthReport = {
  ok: boolean;
  pluginName: string;
  version: string;
  hookEvents: string[];
  skills: string[];
  credentialShapedFiles: string[];
  unwantedFiles: string[];
  errors: string[];
};

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

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, any>;
}

export async function inspectPlugin(pluginRoot: string): Promise<PluginHealthReport> {
  const root = resolve(pluginRoot);
  const errors: string[] = [];
  let manifest: Record<string, any> = {};
  let hookFile: Record<string, any> = {};
  try { manifest = await readJson(join(root, ".codex-plugin", "plugin.json")); }
  catch (error) { errors.push(`manifest unreadable: ${String(error)}`); }
  try { hookFile = await readJson(join(root, "hooks", "hooks.json")); }
  catch (error) { errors.push(`hooks unreadable: ${String(error)}`); }

  if (basename(root) !== manifest.name) errors.push("plugin folder and manifest name differ");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(String(manifest.version ?? ""))) {
    errors.push("plugin version is not strict semver");
  }
  if (manifest.skills !== "./skills/") errors.push("manifest must expose ./skills/");
  if (manifest.hooks !== undefined) errors.push("manifest must rely on default hooks/hooks.json discovery");
  if (manifest.interface?.category !== "Developer Tools") errors.push("plugin category must be Developer Tools");

  const hooks = hookFile.hooks && typeof hookFile.hooks === "object" ? hookFile.hooks as Record<string, unknown> : {};
  const hookEvents = Object.keys(hooks).sort();
  for (const required of ["SessionStart", "UserPromptSubmit", "PostToolUse", "Stop"]) {
    if (!hookEvents.includes(required)) errors.push(`missing ${required} hook`);
  }
  const serializedHooks = JSON.stringify(hookFile);
  if (!serializedHooks.includes("${PLUGIN_ROOT}/hooks/main.mjs")) errors.push("hook command does not use the bundled PLUGIN_ROOT entrypoint");
  if (serializedHooks.includes("bun ")) errors.push("distributed hook config must not require Bun");
  if (/\/(?:Users|home)\//.test(serializedHooks)) errors.push("hook config contains an absolute user path");

  const skillRoot = join(root, "skills");
  let skills: string[] = [];
  try {
    skills = (await readdir(skillRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const skill of skills) {
      const definition = await readFile(join(skillRoot, skill, "SKILL.md"), "utf8");
      if (!definition.startsWith("---\n") || !definition.includes(`name: ${skill}`) || !/description: .+/.test(definition)) {
        errors.push(`invalid skill definition: ${skill}`);
      }
    }
  } catch (error) {
    errors.push(`skills unreadable: ${String(error)}`);
  }

  let relativeFiles: string[] = [];
  try { relativeFiles = (await filesBelow(root)).map((path) => path.slice(root.length + 1)); }
  catch (error) { errors.push(`plugin files unreadable: ${String(error)}`); }
  const credentialShapedFiles = relativeFiles.filter((path) =>
    /(?:^|\/)(?:auth\.json|credentials?(?:\.|$)|secrets?(?:\.|$)|\.env(?:\.|$))/i.test(path)
  );
  if (credentialShapedFiles.length > 0) errors.push("credential-shaped files are present");
  const unwantedFiles = relativeFiles.filter((path) => path.split("/").some((name) =>
    name === ".DS_Store" || name === "Thumbs.db" || name.startsWith("._")
  ));
  if (unwantedFiles.length > 0) errors.push("operating-system metadata files are present");
  if (!relativeFiles.includes("hooks/main.mjs")) errors.push("bundled Node hook entrypoint is missing");
  if (relativeFiles.some((path) => path.startsWith("fixtures/") || path.startsWith(".runs/"))) {
    errors.push("development fixtures or runs are present in the plugin package");
  }

  return {
    ok: errors.length === 0,
    pluginName: String(manifest.name ?? ""),
    version: String(manifest.version ?? ""),
    hookEvents,
    skills,
    credentialShapedFiles,
    unwantedFiles,
    errors,
  };
}

if (import.meta.main) {
  const pluginRoot = resolve(process.argv[2] ?? join(import.meta.dir, "..", "plugins", "riqor"));
  const report = await inspectPlugin(pluginRoot);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exit(1);
}
