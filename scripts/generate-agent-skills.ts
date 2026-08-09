import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const sourceRoot = join(root, ".codex", "agents");
const pluginRoot = join(root, "plugins", "riqor");
const pluginAgentRoot = join(pluginRoot, ".codex", "agents");
const skillRoot = join(pluginRoot, "skills");
const profilePath = join(pluginRoot, ".codex", "riqor.config.toml");
const mapPath = join(pluginRoot, "agent-skill-map.json");
const indexPath = join(skillRoot, "riqor-core", "references", "specialists.md");
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

function titleize(slug: string) {
  return slug.split("-").map((word) => word ? word[0]!.toUpperCase() + word.slice(1) : word).join(" ");
}
function compact(value: string, max = 190) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}
function tomlString(value: unknown) { return JSON.stringify(String(value)); }
function pairingContract(slug: string) {
  return [
    "## Riqor Mandatory Paired Skill",
    `Mandatory paired Skill: ${slug}`,
    `Before doing any task, load and follow the bundled Skill \`$${slug}\` using the current surface's Skill mechanism.`,
    "Treat the paired Skill as required operating guidance, not optional context.",
    "Do not silently substitute another Skill. Additional relevant Skills may be used only after the paired Skill is loaded.",
    "If the paired Skill is unavailable, stop and report the pairing failure instead of continuing as if pairing succeeded.",
  ].join("\n");
}
function renderAgent(source: Record<string, unknown>, slug: string) {
  return Object.entries(source).map(([key, value]) => {
    const rendered = key === "developer_instructions"
      ? `${String(value ?? "").trimEnd()}\n\n${pairingContract(slug)}`
      : value;
    return `${key} = ${tomlString(rendered)}`;
  }).join("\n") + "\n";
}
function renderSkill(slug: string, displayName: string, description: string) {
  const discovery = compact(`Use when the user needs ${description || displayName}. Riqor specialist paired with the ${slug} native agent.`);
  return `---\nname: ${slug}\ndescription: ${JSON.stringify(discovery)}\n---\n\n# ${displayName}\n\nThis is the portable Riqor specialist counterpart for the native \`${slug}\` agent.\n\n1. Read \`references/agent-instructions.md\` before doing the task.\n2. Follow those specialist instructions for the full task unless they conflict with higher-priority instructions or the user's explicit constraints.\n3. Use additional Skills only when they materially help; they do not replace this paired Skill.\n4. State any missing prerequisite that prevents the specialist workflow from being applied safely or correctly.\n`;
}
async function exists(path: string) { try { await access(path); return true; } catch { return false; } }
async function desiredArtifacts() {
  const profile = Bun.TOML.parse(await readFile(profilePath, "utf8")) as any;
  const files = (await readdir(sourceRoot)).filter((name) => name.endsWith(".toml")).sort();
  if (files.length !== 101) throw new Error(`expected 101 canonical agents, found ${files.length}`);
  const artifacts = new Map<string, string>();
  const pairs: any[] = [];
  const index: string[] = ["# Riqor Specialists", "", "The Riqor plugin exposes these native specialist roles as portable bundled Skills for ChatGPT and Codex.", ""];
  for (const file of files) {
    const slug = file.slice(0, -5);
    const sourcePath = join(sourceRoot, file);
    const source = Bun.TOML.parse(await readFile(sourcePath, "utf8")) as Record<string, unknown>;
    const instructions = String(source.developer_instructions ?? "");
    const profileDescription = String(profile.agents?.[slug]?.description ?? "");
    const description = String(source.description ?? profileDescription);
    const displayName = String(source.name ?? titleize(slug));
    const pluginAgent = join(pluginAgentRoot, file);
    const skill = join(skillRoot, slug, "SKILL.md");
    const reference = join(skillRoot, slug, "references", "agent-instructions.md");
    const referenceContent = instructions.endsWith("\n") ? instructions : `${instructions}\n`;
    artifacts.set(pluginAgent, renderAgent(source, slug));
    artifacts.set(skill, renderSkill(slug, displayName, description));
    artifacts.set(reference, referenceContent);
    pairs.push({
      slug,
      displayName,
      sourceAgent: relative(root, sourcePath),
      pluginAgent: relative(root, pluginAgent),
      skill: relative(root, skill),
      reference: relative(root, reference),
      instructionsSha256: sha256(instructions),
      referenceSha256: sha256(referenceContent),
    });
    index.push(`- \`$${slug}\` — ${compact(description || displayName, 220)}`);
  }
  artifacts.set(mapPath, `${JSON.stringify({ schemaVersion: 1, pairs }, null, 2)}\n`);
  artifacts.set(indexPath, `${index.join("\n")}\n`);
  return { artifacts, slugs: files.map((file) => file.slice(0, -5)) };
}
async function checkCurrent(artifacts: Map<string, string>) {
  const stale: string[] = [];
  for (const [path, expected] of artifacts) {
    if (!(await exists(path)) || await readFile(path, "utf8") !== expected) stale.push(relative(root, path));
  }
  return stale;
}
async function writeArtifacts(artifacts: Map<string, string>, slugs: string[]) {
  for (const slug of slugs) await rm(join(skillRoot, slug), { recursive: true, force: true });
  for (const [path, content] of artifacts) {
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, content);
  }
}

const { artifacts, slugs } = await desiredArtifacts();
if (process.argv.includes("--check")) {
  const stale = await checkCurrent(artifacts);
  if (stale.length) { console.error(`stale generated agent-skill artifacts:\n${stale.join("\n")}`); process.exit(1); }
  console.log(`agent-skill catalog current: ${slugs.length} pairs`);
} else {
  await writeArtifacts(artifacts, slugs);
  console.log(`generated ${slugs.length} agent-skill pairs`);
}
