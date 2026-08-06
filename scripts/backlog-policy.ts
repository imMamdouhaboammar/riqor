import { lstat, readdir } from "node:fs/promises";
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

type RecordValue = Record<string, unknown>;
type DependencyNode = Readonly<{ id: string; dependencies: readonly string[] }>;

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
  const backlogRoot = join(root, "backlog");
  await safeEntry(backlogRoot, "directory");
  for (const section of ["initiatives", "items"]) {
    const directory = join(backlogRoot, section);
    await safeEntry(directory, "directory");
    const names = (await readdir(directory)).filter((name) => name.endsWith(".yml"));
    if (names.length > MAX_RECORD_FILES) {
      throw new Error(`backlog ${section} exceeds ${MAX_RECORD_FILES} files`);
    }
    for (const name of names) await safeEntry(join(directory, name), "file");
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

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function nestedFieldErrors(item: BacklogItem): string[] {
  const errors = [
    ...unknownFields(item.sourcePath, item.scope, NESTED_KEYS.scope, "scope"),
    ...unknownFields(item.sourcePath, item.risk, NESTED_KEYS.risk, "risk"),
    ...unknownFields(item.sourcePath, item.github, NESTED_KEYS.github, "github"),
  ];
  item.inspirations?.forEach((entry, index) => {
    errors.push(...unknownFields(
      `${item.sourcePath} inspiration ${index + 1}`,
      entry,
      NESTED_KEYS.inspiration,
      "inspiration",
    ));
  });
  item.acceptance?.forEach((entry, index) => {
    errors.push(...unknownFields(
      `${item.sourcePath} acceptance ${index + 1}`,
      entry,
      NESTED_KEYS.acceptance,
      "acceptance",
    ));
  });
  if (item.blocked) {
    errors.push(...unknownFields(item.sourcePath, item.blocked, NESTED_KEYS.blocked, "blocked"));
  }
  if (item.completion) {
    errors.push(...unknownFields(
      item.sourcePath,
      item.completion,
      NESTED_KEYS.completion,
      "completion",
    ));
  }
  return errors;
}

function initiativeFieldErrors(initiative: BacklogInitiative): string[] {
  const errors = [
    ...unknownFields(initiative.sourcePath, initiative, INITIATIVE_KEYS, "initiative"),
    ...unknownFields(initiative.sourcePath, initiative.scope, NESTED_KEYS.scope, "scope"),
  ];
  initiative.inspirations?.forEach((entry, index) => {
    errors.push(...unknownFields(
      `${initiative.sourcePath} inspiration ${index + 1}`,
      entry,
      NESTED_KEYS.inspiration,
      "inspiration",
    ));
  });
  return errors;
}

function dependencyCycles(nodes: readonly DependencyNode[], label: string): string[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const active = new Set<string>();
  const completed = new Set<string>();
  const errors: string[] = [];

  function visit(id: string, trail: string[]): void {
    if (active.has(id)) {
      errors.push(`${label} dependency cycle: ${[...trail, id].join(" -> ")}`);
      return;
    }
    if (completed.has(id)) return;
    const node = byId.get(id);
    if (!node) return;
    active.add(id);
    for (const dependency of node.dependencies ?? []) {
      visit(dependency, [...trail, id]);
    }
    active.delete(id);
    completed.add(id);
  }

  for (const node of nodes) visit(node.id, []);
  return errors;
}

function readinessErrors(backlog: Backlog): string[] {
  const byId = new Map(backlog.items.map((item) => [item.id, item]));
  const errors: string[] = [];
  for (const item of backlog.items) {
    if (!["ready", "in-progress", "review", "done"].includes(item.status)) continue;
    for (const dependency of item.dependencies ?? []) {
      const prerequisite = byId.get(dependency);
      if (prerequisite && prerequisite.status !== "done") {
        errors.push(`${item.id}: ${item.status} requires completed dependency ${dependency}`);
      }
    }
  }
  return errors;
}

export function validateBacklogPolicy(backlog: Backlog): string[] {
  const errors = [
    ...validateBacklog(backlog),
    ...backlog.initiatives.flatMap(initiativeFieldErrors),
    ...backlog.items.flatMap((item) => [
      ...unknownFields(item.sourcePath, item, ITEM_KEYS, "item"),
      ...nestedFieldErrors(item),
    ]),
    ...dependencyCycles(backlog.initiatives, "initiative"),
    ...readinessErrors(backlog),
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
