import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dir, "..");
const skillsRoot = join(root, ".agents", "skills");
const configPath = join(root, "config", "skill-curation.json");
const lockPath = join(root, "skills-lock.json");
const eccManifestPath = join(root, ".claude", "ecc-tools.json");

type ApprovedSkill = {
  name: string;
  source: string;
  skillPath: string;
  computedHash?: string;
  upstreamComputedHash?: string;
  curatedContentHash?: string;
  [key: string]: unknown;
};

type Curation = {
  approvedSkills: ApprovedSkill[];
  sources: Record<string, { repository: string; commit: string }>;
  [key: string]: unknown;
};

type EccManifest = {
  managedFiles?: unknown;
};

async function filesUnder(directory: string): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(path));
    else if (entry.isFile()) output.push(path);
  }
  return output.sort();
}

export async function canonicalSkillDigest(directory: string) {
  const hash = createHash("sha256");
  for (const path of await filesUnder(directory)) {
    const name = relative(directory, path).split(sep).join("/");
    hash.update(name).update("\0").update(await readFile(path)).update("\0");
  }
  return hash.digest("hex");
}

export function repositorySkillDirectories(managedFiles: unknown): string[] {
  if (!Array.isArray(managedFiles)) return [];
  const directories = new Set<string>();
  for (const file of managedFiles) {
    if (typeof file !== "string") continue;
    const match = file.match(/^\.agents\/skills\/([^/]+)\/SKILL\.md$/);
    if (match) directories.add(match[1]);
  }
  return [...directories].sort();
}

async function main() {
  const write = process.argv.includes("--write");
  const curation = JSON.parse(await readFile(configPath, "utf8")) as Curation;
  const lock = JSON.parse(await readFile(lockPath, "utf8")) as {
    skills: Record<string, { computedHash: string }>;
  };
  const ecc = JSON.parse(await readFile(eccManifestPath, "utf8")) as EccManifest;
  const repositorySkills = repositorySkillDirectories(ecc.managedFiles);
  const installed = (await readdir(skillsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const actual = installed.filter((name) => !repositorySkills.includes(name));
  const expected = curation.approvedSkills.map((entry) => entry.name).sort();
  const locked = Object.keys(lock.skills).sort();

  for (const name of repositorySkills) {
    if (!installed.includes(name)) throw new Error(`missing manifest-owned repository skill: ${name}`);
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected) || JSON.stringify(actual) !== JSON.stringify(locked)) {
    throw new Error("curated skill allowlist does not match installed and locked external directories");
  }

  const digests: Record<string, string> = {};
  for (const name of actual) digests[name] = await canonicalSkillDigest(join(skillsRoot, name));
  for (const source of Object.values(curation.sources)) {
    if (!/^[a-f0-9]{40}$/.test(source.commit)) throw new Error(`invalid source revision for ${source.repository}`);
  }

  for (const record of curation.approvedSkills) {
    const upstream = lock.skills[record.name]?.computedHash;
    if (!upstream || !/^[a-f0-9]{64}$/.test(upstream)) throw new Error(`missing upstream hash for ${record.name}`);
    if (write) {
      delete record.computedHash;
      record.upstreamComputedHash = upstream;
      record.curatedContentHash = digests[record.name];
    } else {
      if (record.upstreamComputedHash !== upstream) throw new Error(`upstream hash mismatch for ${record.name}`);
      if (record.curatedContentHash !== digests[record.name]) throw new Error(`curated content hash mismatch for ${record.name}`);
    }
  }

  if (write) await writeFile(configPath, `${JSON.stringify(curation, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({
    ok: true,
    curatedSkills: actual.length,
    repositorySkills,
    digests,
  }, null, 2)}\n`);
}

if (import.meta.main) {
  try { await main(); }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "skill curation health failed"}\n`);
    process.exitCode = 1;
  }
}
