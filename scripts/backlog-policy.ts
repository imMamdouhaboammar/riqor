import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  type Backlog,
  type BacklogInitiative,
  type BacklogItem,
  validateBacklog,
} from "./backlog-lib";

const INITIATIVE_KEYS = new Set([
  "schemaVersion",
  "id",
  "title",
  "status",
  "priority",
  "ownerProject",
  "problem",
  "outcome",
  "scope",
  "dependencies",
  "items",
  "releaseTargets",
  "successMetrics",
  "inspirations",
  "sourcePath",
]);
const ITEM_KEYS = new Set([
  "schemaVersion",
  "id",
  "title",
  "type",
  "status",
  "priority",
  "initiative",
  "phase",
  "ownerProject",
  "collaborators",
  "problem",
  "outcome",
  "scope",
  "dependencies",
  "acceptance",
  "evidenceRequired",
  "risk",
  "github",
  "releaseTarget",
  "inspirations",
  "blocked",
  "completion",
  "sourcePath",
]);
const MAX_RECORD_FILES = 1000;
const MAX_RECORD_BYTES = 128 * 1024;
const NESTED_KEYS = Object.freeze({
  scope: new Set(["included", "excluded"]),
  inspiration: new Set(["project", "concepts"]),
  acceptance: new Set(["id", "command"]),
  risk: new Set(["level", "areas"]),
  github: new Set(["issue", "pr", "milestone"]),
  blocked: new Set(["reason", "owner", "nextAction"]),
  completion: new Set(["mergedPr", "commit", "evidence"]),
});
const WIP_LIMITS = Object.freeze({ runtime: 2, governance: 1, release: 1 });

type RecordValue = Record<string, unknown>;
type BunYamlRuntime = Readonly<{
  Bun?: Readonly<{ YAML?: Readonly<{ parse(input: string): unknown }> }>;
}>;
type WorkClass = keyof typeof WIP_LIMITS;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function yamlParser(): (input: string) => unknown {
  const parser = (globalThis as BunYamlRuntime).Bun?.YAML?.parse;
  if (!parser) throw new Error("Bun YAML parser is unavailable");
  return parser;
}

async function safeEntry(path: string, expected: "directory" | "file"): Promise<void> {
  const entry = await lstat(path);
  if (entry.isSymbolicLink()) throw new Error(`unsafe symlink backlog path: ${path}`);
  if (expected === "directory" && !entry.isDirectory()) {
    throw new Error(`backlog path is not a directory: ${path}`);
  }
  if (expected === "file" && !entry.isFile()) {
    throw new Error(`backlog path is not a regular file: ${path}`);
  }
  if (expected === "file" && entry.size > MAX_RECORD_BYTES) {
    throw new Error(`backlog file exceeds ${MAX_RECORD_BYTES} bytes: ${path}`);
  }
}

export async function assertBacklogPathsSafe(root: string): Promise<void> {
  const parser = yamlParser();
  const backlogRoot = join(root, "backlog");
  await safeEntry(backlogRoot, "directory");
  for (const section of ["initiatives", "items"]) {
    const directory = join(backlogRoot, section);
    await safeEntry(directory, "directory");
    const names = (await readdir(directory)).filter((name) => name.endsWith(".yml"));
    if (names.length > MAX_RECORD_FILES) {
      throw new Error(`backlog ${section} exceeds ${MAX_RECORD_FILES} files`);
    }
    for (const name of names) {
      const path = join(directory, name);
      await safeEntry(path, "file");
      let decoded: unknown;
      try {
        decoded = parser(await readFile(path, "utf8"));
      } catch (error) {
        throw new Error(`${path}: ${(error as Error).message}`);
      }
      if (isRecord(decoded) && Object.hasOwn(decoded, "sourcePath")) {
        throw new Error(`${path}: sourcePath is reserved for internal use`);
      }
    }
  }
}

export async function assertGeneratedViewPathsSafe(root: string): Promise<void> {
  const docs = join(root, "docs");
  const backlogDocs = join(docs, "backlog");
  await safeEntry(docs, "directory");
  await safeEntry(backlogDocs, "directory");
  for (const path of [join(root, "BACKLOG.md"), join(backlogDocs, "CURRENT.md")]) {
    try {
      const entry = await lstat(path);
      if (entry.isSymbolicLink()) throw new Error(`unsafe symlink generated view: ${path}`);
      if (!entry.isFile()) throw new Error(`generated view is not a regular file: ${path}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

function unknownFields(
  source: string,
  value: unknown,
  allowed: ReadonlySet<string>,
  label: string,
): string[] {
  if (!isRecord(value)) return [];
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .map((key) => `${source}: unknown ${label} field ${key}`);
}

function duplicateErrors(source: string, label: string, value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<unknown>();
  const duplicates = new Set<string>();
  for (const entry of value) {
    const key = typeof entry === "string" || typeof entry === "number"
      ? `${typeof entry}:${entry}`
      : JSON.stringify(entry);
    if (seen.has(key)) duplicates.add(String(entry));
    seen.add(key);
  }
  return [...duplicates].map((entry) => `${source}: duplicate ${label} value ${entry}`);
}

function inspirationErrors(source: string, value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const errors: string[] = [];
  value.forEach((entry, index) => {
    const label = `${source} inspiration ${index + 1}`;
    errors.push(...unknownFields(label, entry, NESTED_KEYS.inspiration, "inspiration"));
    if (isRecord(entry)) {
      errors.push(...duplicateErrors(label, "concepts", entry.concepts));
    }
  });
  return errors;
}

function initiativeFieldErrors(initiative: BacklogInitiative): string[] {
  const source = initiative.sourcePath;
  const scope = isRecord(initiative.scope) ? initiative.scope : {};
  return [
    ...unknownFields(source, initiative, INITIATIVE_KEYS, "initiative"),
    ...unknownFields(source, initiative.scope, NESTED_KEYS.scope, "scope"),
    ...duplicateErrors(source, "scope.included", scope.included),
    ...duplicateErrors(source, "scope.excluded", scope.excluded),
    ...duplicateErrors(source, "dependencies", initiative.dependencies),
    ...duplicateErrors(source, "items", initiative.items),
    ...duplicateErrors(source, "releaseTargets", initiative.releaseTargets),
    ...duplicateErrors(source, "successMetrics", initiative.successMetrics),
    ...inspirationErrors(source, initiative.inspirations),
  ];
}

function itemFieldErrors(item: BacklogItem): string[] {
  const source = item.sourcePath;
  const scope = isRecord(item.scope) ? item.scope : {};
  const risk = isRecord(item.risk) ? item.risk : {};
  const completion = isRecord(item.completion) ? item.completion : {};
  const errors = [
    ...unknownFields(source, item, ITEM_KEYS, "item"),
    ...unknownFields(source, item.scope, NESTED_KEYS.scope, "scope"),
    ...unknownFields(source, item.risk, NESTED_KEYS.risk, "risk"),
    ...unknownFields(source, item.github, NESTED_KEYS.github, "github"),
    ...duplicateErrors(source, "scope.included", scope.included),
    ...duplicateErrors(source, "scope.excluded", scope.excluded),
    ...duplicateErrors(source, "dependencies", item.dependencies),
    ...duplicateErrors(source, "collaborators", item.collaborators),
    ...duplicateErrors(source, "evidenceRequired", item.evidenceRequired),
    ...duplicateErrors(source, "risk.areas", risk.areas),
    ...duplicateErrors(source, "completion.evidence", completion.evidence),
    ...inspirationErrors(source, item.inspirations),
  ];
  if (Array.isArray(item.acceptance)) {
    item.acceptance.forEach((entry, index) => {
      errors.push(...unknownFields(
        `${source} acceptance ${index + 1}`,
        entry,
        NESTED_KEYS.acceptance,
        "acceptance",
      ));
    });
    errors.push(...duplicateErrors(
      source,
      "acceptance.id",
      item.acceptance.map((entry) => isRecord(entry) ? entry.id : entry),
    ));
  }
  if (isRecord(item.blocked)) {
    errors.push(...unknownFields(source, item.blocked, NESTED_KEYS.blocked, "blocked"));
  }
  if (isRecord(item.completion)) {
    errors.push(...unknownFields(source, item.completion, NESTED_KEYS.completion, "completion"));
  }
  return errors;
}

function initiativeCycleErrors(initiatives: readonly BacklogInitiative[]): string[] {
  const remaining = new Set(initiatives.map((initiative) => initiative.id));
  const byId = new Map(initiatives.map((initiative) => [initiative.id, initiative]));
  let removed = true;
  while (removed && remaining.size > 0) {
    removed = false;
    for (const id of [...remaining]) {
      const dependencies = byId.get(id)?.dependencies;
      if (!Array.isArray(dependencies) || dependencies.every((dependency) => !remaining.has(dependency))) {
        remaining.delete(id);
        removed = true;
      }
    }
  }
  return remaining.size > 0
    ? [`initiative dependency cycle: ${[...remaining].sort().join(", ")}`]
    : [];
}

function readinessErrors(backlog: Backlog): string[] {
  const byId = new Map(‰…­±½œ¹¥Ñ•µÌ¹µ…À ¡¥Ñ•´¤€ôøm¥Ñ•´¹¥°¥Ñ•µt¤¤ì(€½¹ÍĞ•ÉÉ½ÉÌèÍÑÉ¥¹mt€ômtì(€™½È€¡½¹ÍĞ¥Ñ•´½˜‰…­±½œ¹¥Ñ•µÌ¤ì(€€€¥˜€ …l‰É•…‘äˆ°€‰¥¸µÁÉ½É•ÍÌˆ°€‰É•Ù¥•Üˆ°€‰‘½¹”‰t¹¥¹±Õ‘•Ì¡¥Ñ•´¹ÍÑ…ÑÕÌ¤¤½¹Ñ¥¹Õ”ì(€€€¥˜€ …ÉÉ…ä¹¥ÍÉÉ…ä¡¥Ñ•´¹‘•Á•¹‘•¹¥•Ì¤¤½¹Ñ¥¹Õ”ì(€€€™½È€¡½¹ÍĞ‘•Á•¹‘•¹ä½˜¥Ñ•´¹‘•Á•¹‘•¹¥•Ì¤ì(€€€€€½¹ÍĞÁÉ•É•ÅÕ¥Í¥Ñ”€ô‰å%¹•Ğ¡‘•Á•¹‘•¹ä¤ì(€€€€€¥˜€¡ÁÉ•É•ÅÕ¥Í¥Ñ”€˜˜ÁÉ•É•ÅÕ¥Í¥Ñ”¹ÍÑ…ÑÕÌ€„ôô€‰‘½¹”ˆ¤ì(€€€€€€€•ÉÉ½ÉÌ¹ÁÕÍ ¡€‘í¥Ñ•´¹¥‘ôè€‘í¥Ñ•´¹ÍÑ…ÑÕÍôÉ•ÅÕ¥É•Ì½µÁ±•Ñ•‘•Á•¹‘•¹ä€‘í‘•Á•¹‘•¹åõ€¤ì(€€€€€ô(€€€ô(€ô(€É•ÑÕÉ¸•ÉÉ½ÉÌì)ô()™Õ¹Ñ¥½¸İ½É­±…ÍÌ¡¥Ñ•´è	…­±½%Ñ•´¤è]½É­±…ÍÌì(€¥˜€¡¥Ñ•´¹ÑåÁ”€ôôô€‰É•±•…Í”ˆ¤É•ÑÕÉ¸€‰É•±•…Í”ˆì(€¥˜€¡¥Ñ•´¹ÑåÁ”€ôôô€‰‘½Õµ•¹Ñ…Ñ¥½¸ˆñğ¥Ñ•´¹ÑåÁ”€ôôô€‰µ…¥¹Ñ•¹…¹”ˆ¤É•ÑÕÉ¸€‰½Ù•É¹…¹”ˆì(€É•ÑÕÉ¸€‰ÉÕ¹Ñ¥µ”ˆì)ô()™Õ¹Ñ¥½¸İ¥ÁÉÉ½ÉÌ¡‰…­±½œè	…­±½œ¤èÍÑÉ¥¹mtì(€½¹ÍĞ…Ñ¥Ù”€ô‰…­±½œ¹¥Ñ•µÌ¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹ÍÑ…ÑÕÌ€ôôô€‰¥¸µÁÉ½É•ÍÌˆ¤ì(€½¹ÍĞ•ÉÉ½ÉÌèÍÑÉ¥¹mt€ômtì(€½¹ÍĞ‰å±…ÍÌ€ô¹•Ü5…Àñ]½É­±…ÍÌ°M•ĞñÍÑÉ¥¹œøø ¤ì(€™½È€¡½¹ÍĞ¥Ñ•´½˜…Ñ¥Ù”¤ì(€€€½¹ÍĞ…Ñ•½Éä€ôİ½É­±…ÍÌ¡¥Ñ•´¤ì(€€€½¹ÍĞÉ•™•É•¹”€ô9Õµ‰•È¹¥Í%¹Ñ••È¡¥Ñ•´¹¥Ñ¡Õˆü¹ÁÈ¤€üÁÈè‘í¥Ñ•´¹¥Ñ¡Õˆ¹ÁÉõ€€è¥Ñ•´è‘í¥Ñ•´¹¥‘õ€ì(€€€½¹ÍĞÙ…±Õ•Ì€ô‰å±…ÍÌ¹•Ğ¡…Ñ•½Éä¤€üü¹•ÜM•ĞñÍÑÉ¥¹œø ¤ì(€€€Ù…±Õ•Ì¹…‘¡É•™•É•¹”¤ì(€€€‰å±…ÍÌ¹Í•Ğ¡…Ñ•½Éä°Ù…±Õ•Ì¤ì(€ô(€™½È€¡½¹ÍĞm…Ñ•½Éä°±¥µ¥Ñt½˜=‰©•Ğ¹•¹ÑÉ¥•Ì¡]%A}1%5%QL¤…ÌÉÉ…äñm]½É­±…ÍÌ°¹Õµ‰•Étø¤ì(€€€½¹ÍĞ½Õ¹Ğ€ô‰å±…ÍÌ¹•Ğ¡…Ñ•½Éä¤ü¹Í¥é”€üü€Àì(€€€¥˜€¡½Õ¹Ğ€ø±¥µ¥Ğ¤ì(€€€€€•ÉÉ½ÉÌ¹ÁÕÍ ¡]%@±¥µ¥Ğ•á••‘•è€‘í…Ñ•½Éåô¡…Ì€‘í½Õ¹Ñô…Ñ¥Ù”ÁÕ±°É•ÅÕ•ÍÑÌ°µ…á¥µÕ´€‘í±¥µ¥Ñõ€¤ì(€€€ô(€ô(€É•ÑÕÉ¸•ÉÉ½ÉÌì)ô()™Õ¹Ñ¥½¸‰…Í•Y…±¥‘…Ñ¥½¹ÉÉ½ÉÌ¡‰…­±½œè	…­±½œ¤èÍÑÉ¥¹mtì(€ÑÉäì(€€€É•ÑÕÉ¸Ù…±¥‘…Ñ•	…­±½œ¡‰…­±½œ¤ì(€ô…Ñ €¡•ÉÉ½È¤ì(€€€É•ÑÕÉ¸mµ…±™½Éµ•‰…­±½œ½±±•Ñ¥½¸è€‘ì¡•ÉÉ½È…ÌÉÉ½È¤¹µ•ÍÍ…•õtì(€ô)ô()•áÁ½ÉĞ™Õ¹Ñ¥½¸Ù…±¥‘…Ñ•	…­±½A½±¥ä¡‰…­±½œè	…­±½œ¤èÍÑÉ¥¹mtì(€½¹ÍĞ•ÉÉ½ÉÌ€ôl(€€€€¸¸¹‰…Í•Y…±¥‘…Ñ¥½¹ÉÉ½ÉÌ¡‰…­±½œ¤°(€€€€¸¸¹‰…­±½œ¹¥¹¥Ñ¥…Ñ¥Ù•Ì¹™±…Ñ5…À¡¥¹¥Ñ¥…Ñ¥Ù•¥•±‘ÉÉ½ÉÌ¤°(€€€€¸¸¹‰…­±½œ¹¥Ñ•µÌ¹™±…Ñ5…À¡¥Ñ•µ¥•±‘ÉÉ½ÉÌ¤°(€€€€¸¸¹¥¹¥Ñ¥…Ñ¥Ù•å±•ÉÉ½ÉÌ¡‰…­±½œ¹¥¹¥Ñ¥…Ñ¥Ù•Ì¤°(€€€€¸¸¹É•…‘¥¹•ÍÍÉÉ½ÉÌ¡‰…­±½œ¤°(€€€€¸¸¹İ¥ÁÉÉ½ÉÌ¡‰…­±½œ¤°(€tì(€É•ÑÕÉ¸l¸¸¹¹•ÜM•Ğ¡•ÉÉ½ÉÌ¥t¹Í½ÉĞ ¤ì)ô()•áÁ½ÉĞ™Õ¹Ñ¥½¸…ÍÍ•ÉÑ	…­±½A½±¥ä¡‰…­±½œè	…­±½œ¤èÙ½¥ì(€½¹ÍĞ•ÉÉ½ÉÌ€ôÙ…±¥‘…Ñ•	…­±½A½±¥ä¡‰…­±½œ¤ì(€¥˜€¡•ÉÉ½ÉÌ¹±•¹Ñ €ø€À¤ì(€€€Ñ¡É½Ü¹•ÜÉÉ½È (€€€€€‰…­±½œÁ½±¥äÙ…±¥‘…Ñ¥½¸™…¥±•‘q¸‘í•ÉÉ½ÉÌ¹µ…À ¡•ÉÉ½È¤€ôø€´€‘í•ÉÉ½Éõ€¤¹©½¥¸ ‰q¸ˆ¥õ€°(€€€€¤ì(€ô)ô(