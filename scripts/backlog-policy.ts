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
  const byId = new Map(backlog.items.map((item) => [item.id, item]));
  const errors: string[] = [];
  for (const item of backlog.items) {
    if (!["ready", "in-progress", "review", "done"].includes(item.status)) continue;
    if (!Array.isArray(item.dependencies)) continue;
    for (const dependency of item.dependencies) {
      const prerequisite = byId.get(dependency);
      if (prerequisite && prerequisite.status !== "done") {
        errors.push(`${item.id}: ${item.status} requires completed dependency ${dependency}`);
      }
    }
  }
  return errors;
}

function workClass(item: BacklogItem): WorkClass {
  if (item.type === "release") return "release";
  if (item.type === "documentation" || item.type === "maintenance") return "governance";
  return "runtime";
}

function wipErrors(backlog: Backlog): string[] {
  const active = backlog.items.filter((item) => item.status === "in-progress");
  const errors: string[] = [];
  const byClass = new Map<WorkClass, Set<string>>();
  for (const item of active) {
    const category = workClass(item);
    const reference = Number.isInteger(item.github?.pr) ? `pr:${item.github.pr}` : `item:${item.id}`;
    const values = byClass.get(category) ?? new Set<string>();
    values.add(reference);
    byClass.set(category, values);
  }
  for (const [category, limit] of Object.entries(WIP_LIMITS) as Array<[WorkClass, number]>) {
    const count = byClass.get(category)?.size ?? 0;
    if (count > limit) {
      errors.push(`WIP limit exceeded: ${category} has ${count} active pull requests, maximum ${limit}`);
    }
  }
  return errors;
}

function baseValidationErrors(backlog: Backlog): string[] {
  try {
    return validateBacklog(backlog).filter(
      (error) => error !== "WIP limit exceeded: more than two in-progress items",
    );
  } catch (error) {
    return [`malformed backlog collection: ${(error as Error).message}`];
  }
}

export function validateBacklogPolicy(backlog: Backlog): string[] {
  const errors = [
    ...baseValidationErrors(backlog),
    ...backlog.initiatives.flatMap(initiativeFieldErrors),
    ...backlog.items.flatMap(itemFieldErrors),
    ...initiativeCycleErrors(backlog.initiatives),
    ...readinessErrors(backlog),
    ...wipErrors(backlog),
  ];
  return [...new Set(errors)].sort();
}

export function assertBacklogPolicy(backlog: Backlog): void {
  const errors = validateBacklogPolicy(backlog);
  if (errors.length > 0) {
    throw new Error(
      `backlog policy validation failed\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }
}
