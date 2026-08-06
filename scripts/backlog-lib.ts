import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const INITIATIVE_ID = /^RIQ-00[1-9]$/;
const ITEM_ID = /^RIQ-[1-9][0-9]{2}$/;
const FILE_ID = /^(RIQ-[0-9]{3})-/;
const RELEASE = /^0\.[0-9]+\.[0-9]+$/;

const INITIATIVE_STATUSES = new Set(["planned", "active", "paused", "complete"]);
const ITEM_STATUSES = new Set([
  "proposed",
  "accepted",
  "ready",
  "in-progress",
  "blocked",
  "review",
  "done",
  "deferred",
  "rejected",
]);
const PRIORITIES = new Set(["P0", "P1", "P2", "P3", "icebox"]);
const ITEM_TYPES = new Set([
  "feature",
  "integration",
  "security",
  "test",
  "release",
  "maintenance",
  "research",
  "documentation",
]);
const COLLABORATORS = new Set([
  "agent-kernel",
  "delegate-team",
  "dokion",
  "codex-security",
  "creative",
]);
const EVIDENCE_TYPES = new Set([
  "focused-test",
  "integration-test",
  "package-gate",
  "review",
  "security-review",
  "privacy-review",
  "artifact",
  "manual-evidence",
]);
const RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);
const INSPIRATION_PROJECTS = new Set([
  "LightAgent",
  "fable5-mode",
  "agent-harness",
  "internal",
]);

export type Inspiration = Readonly<{
  project: string;
  concepts: readonly string[];
}>;

export type BacklogInitiative = Readonly<{
  schemaVersion: 1;
  id: string;
  title: string;
  status: "planned" | "active" | "paused" | "complete";
  priority: "P0" | "P1" | "P2" | "P3" | "icebox";
  ownerProject: "riqor";
  problem: string;
  outcome: string;
  scope: Readonly<{
    included: readonly string[];
    excluded: readonly string[];
  }>;
  dependencies: readonly string[];
  items: readonly string[];
  releaseTargets: readonly string[];
  successMetrics: readonly string[];
  inspirations: readonly Inspiration[];
  sourcePath: string;
}>;

export type BacklogItem = Readonly<{
  schemaVersion: 1;
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  initiative: string;
  phase: string;
  ownerProject: "riqor";
  collaborators: readonly string[];
  problem: string;
  outcome: string;
  scope: Readonly<{
    included: readonly string[];
    excluded: readonly string[];
  }>;
  dependencies: readonly string[];
  acceptance: readonly Readonly<{ id: string; command: string }>[];
  evidenceRequired: readonly string[];
  risk: Readonly<{ level: string; areas: readonly string[] }>;
  github: Readonly<{
    issue: number | null;
    pr: number | null;
    milestone: string | null;
  }>;
  releaseTarget: string;
  inspirations: readonly Inspiration[];
  blocked: Readonly<{ reason: string; owner: string; nextAction: string }> | null;
  completion: Readonly<{
    mergedPr: number;
    commit: string;
    evidence: readonly string[];
  }> | null;
  sourcePath: string;
}>;

export type Backlog = Readonly<{
  initiatives: readonly BacklogInitiative[];
  items: readonly BacklogItem[];
}>;

type BunYamlRuntime = Readonly<{
  Bun?: Readonly<{
    YAML?: Readonly<{
      parse(input: string): unknown;
    }>;
  }>;
}>;

function parseYaml(input: string, path: string): unknown {
  const runtime = globalThis as BunYamlRuntime;
  if (!runtime.Bun?.YAML?.parse) {
    throw new Error("Bun YAML parser is unavailable");
  }
  try {
    const parsed = runtime.Bun.YAML.parse(input);
    if (Array.isArray(parsed)) {
      throw new Error("multi-document YAML is not supported");
    }
    return parsed;
  } catch (error) {
    throw new Error(`${path}: ${(error as Error).message}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function nonEmptyString(value: unknown, minimum = 1): value is string {
  return typeof value === "string" && value.trim().length >= minimum;
}

async function loadYamlDirectory(path: string): Promise<Array<{ path: string; value: unknown }>> {
  const names = (await readdir(path))
    .filter((name) => name.endsWith(".yml"))
    .sort();
  return Promise.all(
    names.map(async (name) => ({
      path: join(path, name),
      value: parseYaml(await readFile(join(path, name), "utf8"), join(path, name)),
    })),
  );
}

function asInitiative(path: string, value: unknown): BacklogInitiative {
  if (!isRecord(value)) {
    return Object.freeze({ sourcePath: path } as BacklogInitiative);
  }
  return Object.freeze({ ...value, sourcePath: path } as BacklogInitiative);
}

function asItem(path: string, value: unknown): BacklogItem {
  if (!isRecord(value)) {
    return Object.freeze({ sourcePath: path } as BacklogItem);
  }
  return Object.freeze({ ...value, sourcePath: path } as BacklogItem);
}

export async function loadBacklog(root: string): Promise<Backlog> {
  const [initiativeFiles, itemFiles] = await Promise.all([
    loadYamlDirectory(join(root, "backlog", "initiatives")),
    loadYamlDirectory(join(root, "backlog", "items")),
  ]);
  const initiatives = initiativeFiles
    .map(({ path, value }) => asInitiative(path, value))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const items = itemFiles
    .map(({ path, value }) => asItem(path, value))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  return Object.freeze({ initiatives, items });
}

function push(errors: string[], source: string, condition: boolean, message: string) {
  if (!condition) errors.push(`${source}: ${message}`);
}

function validateInspiration(
  errors: string[],
  source: string,
  value: unknown,
) {
  push(errors, source, Array.isArray(value) && value.length > 0, "inspirations must be a non-empty array");
  if (!Array.isArray(value)) return;
  for (const [index, inspiration] of value.entries()) {
    const label = `${source} inspiration ${index + 1}`;
    push(errors, label, isRecord(inspiration), "must be an object");
    if (!isRecord(inspiration)) continue;
    push(
      errors,
      label,
      typeof inspiration.project === "string" && INSPIRATION_PROJECTS.has(inspiration.project),
      "has an unknown project",
    );
    push(
      errors,
      label,
      stringArray(inspiration.concepts) && inspiration.concepts.length > 0,
      "concepts must be a non-empty string array",
    );
  }
}

function validateScope(errors: string[], source: string, value: unknown) {
  push(errors, source, isRecord(value), "scope must be an object");
  if (!isRecord(value)) return;
  push(
    errors,
    source,
    stringArray(value.included) && value.included.length > 0,
    "scope.included must be a non-empty string array",
  );
  push(
    errors,
    source,
    stringArray(value.excluded) && value.excluded.length > 0,
    "scope.excluded must be a non-empty string array",
  );
}

function validateFilename(errors: string[], sourcePath: string, id: unknown) {
  const match = basename(sourcePath).match(FILE_ID);
  push(errors, sourcePath, Boolean(match), "filename must start with a backlog ID");
  if (match && typeof id === "string") {
    push(errors, sourcePath, match[1] === id, `filename ID ${match[1]} does not match ${id}`);
  }
}

function validateInitiative(errors: string[], initiative: BacklogInitiative) {
  const source = initiative.sourcePath;
  validateFilename(errors, source, initiative.id);
  push(errors, source, initiative.schemaVersion === 1, "schemaVersion must be 1");
  push(errors, source, typeof initiative.id === "string" && INITIATIVE_ID.test(initiative.id), "invalid initiative ID");
  push(errors, source, nonEmptyString(initiative.title, 3), "title is required");
  push(errors, source, INITIATIVE_STATUSES.has(initiative.status), "invalid initiative status");
  push(errors, source, PRIORITIES.has(initiative.priority), "invalid priority");
  push(errors, source, initiative.ownerProject === "riqor", "ownerProject must be riqor");
  push(errors, source, nonEmptyString(initiative.problem, 20), "problem is too short");
  push(errors, source, nonEmptyString(initiative.outcome, 20), "outcome is too short");
  validateScope(errors, source, initiative.scope);
  push(errors, source, stringArray(initiative.dependencies), "dependencies must be a string array");
  push(errors, source, stringArray(initiative.items) && initiative.items.length > 0, "items must be a non-empty string array");
  push(
    errors,
    source,
    stringArray(initiative.releaseTargets) &&
      initiative.releaseTargets.length > 0 &&
      initiative.releaseTargets.every((target) => RELEASE.test(target)),
    "releaseTargets must contain semantic release versions",
  );
  push(
    errors,
    source,
    stringArray(initiative.successMetrics) && initiative.successMetrics.length > 0,
    "successMetrics must be a non-empty string array",
  );
  validateInspiration(errors, source, initiative.inspirations);
}

function validateItem(errors: string[], item: BacklogItem) {
  const source = item.sourcePath;
  validateFilename(errors, source, item.id);
  push(errors, source, item.schemaVersion === 1, "schemaVersion must be 1");
  push(errors, source, typeof item.id === "string" && ITEM_ID.test(item.id), "invalid item ID");
  push(errors, source, nonEmptyString(item.title, 3), "title is required");
  push(errors, source, typeof item.type === "string" && ITEM_TYPES.has(item.type), "invalid item type");
  push(errors, source, typeof item.status === "string" && ITEM_STATUSES.has(item.status), "invalid item status");
  push(errors, source, typeof item.priority === "string" && PRIORITIES.has(item.priority), "invalid priority");
  push(errors, source, typeof item.initiative === "string" && INITIATIVE_ID.test(item.initiative), "invalid initiative reference");
  push(errors, source, typeof item.phase === "string" && /^[a-z0-9][a-z0-9-]{1,63}$/.test(item.phase), "invalid phase");
  push(errors, source, item.ownerProject === "riqor", "ownerProject must be riqor");
  push(
    errors,
    source,
    stringArray(item.collaborators) && item.collaborators.every((name) => COLLABORATORS.has(name)),
    "collaborators contain an unknown project",
  );
  push(errors, source, nonEmptyString(item.problem, 20), "problem is too short");
  push(errors, source, nonEmptyString(item.outcome, 20), "outcome is too short");
  validateScope(errors, source, item.scope);
  push(errors, source, stringArray(item.dependencies), "dependencies must be a string array");
  push(
    errors,
    source,
    Array.isArray(item.acceptance) &&
      item.acceptance.length > 0 &&
      item.acceptance.every(
        (entry) =>
          isRecord(entry) &&
          nonEmptyString(entry.id, 2) &&
          nonEmptyString(entry.command, 3),
      ),
    "acceptance must contain executable commands",
  );
  push(
    errors,
    source,
    stringArray(item.evidenceRequired) &&
      item.evidenceRequired.length > 0 &&
      item.evidenceRequired.every((entry) => EVIDENCE_TYPES.has(entry)),
    "evidenceRequired contains an unknown evidence type",
  );
  push(errors, source, isRecord(item.risk), "risk must be an object");
  if (isRecord(item.risk)) {
    push(errors, source, typeof item.risk.level === "string" && RISK_LEVELS.has(item.risk.level), "invalid risk level");
    push(
      errors,
      source,
      stringArray(item.risk.areas) && item.risk.areas.length > 0,
      "risk.areas must be a non-empty string array",
    );
  }
  push(errors, source, isRecord(item.github), "github must be an object");
  if (isRecord(item.github)) {
    push(
      errors,
      source,
      item.github.issue === null ||
        (Number.isInteger(item.github.issue) && Number(item.github.issue) > 0),
      "github.issue must be null or a positive integer",
    );
    push(
      errors,
      source,
      item.github.pr === null ||
        (Number.isInteger(item.github.pr) && Number(item.github.pr) > 0),
      "github.pr must be null or a positive integer",
    );
    push(
      errors,
      source,
      item.github.milestone === null ||
        (typeof item.github.milestone === "string" && RELEASE.test(item.github.milestone)),
      "github.milestone must be null or a release version",
    );
  }
  push(errors, source, typeof item.releaseTarget === "string" && RELEASE.test(item.releaseTarget), "invalid releaseTarget");
  validateInspiration(errors, source, item.inspirations);

  if (item.status === "blocked") {
    push(errors, source, isRecord(item.blocked), "blocked items require blocker details");
    if (isRecord(item.blocked)) {
      push(errors, source, nonEmptyString(item.blocked.reason, 8), "blocked.reason is required");
      push(errors, source, nonEmptyString(item.blocked.owner, 2), "blocked.owner is required");
      push(errors, source, nonEmptyString(item.blocked.nextAction, 8), "blocked.nextAction is required");
    }
  } else {
    push(errors, source, item.blocked === null, "non-blocked items must set blocked to null");
  }

  if (item.status === "in-progress" || item.status === "review") {
    push(
      errors,
      source,
      isRecord(item.github) && Number.isInteger(item.github.pr) && Number(item.github.pr) > 0,
      "in-progress and review items require github.pr",
    );
  }

  if (item.status === "done") {
    push(errors, source, isRecord(item.completion), "done items require completion evidence");
  } else {
    push(errors, source, item.completion === null, "non-done items must set completion to null");
  }
}

function detectCycles(items: readonly BacklogItem[]): string[] {
  const errors: string[] = [];
  const byId = new Map(items.map((item) => [item.id, item]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(id: string, trail: string[]) {
    if (visiting.has(id)) {
      errors.push(`dependency cycle: ${[...trail, id].join(" -> ")}`);
      return;
    }
    if (visited.has(id)) return;
    const item = byId.get(id);
    if (!item) return;
    visiting.add(id);
    for (const dependency of item.dependencies ?? []) visit(dependency, [...trail, id]);
    visiting.delete(id);
    visited.add(id);
  }

  for (const item of items) visit(item.id, []);
  return errors;
}

export function validateBacklog(backlog: Backlog): string[] {
  const errors: string[] = [];
  for (const initiative of backlog.initiatives) validateInitiative(errors, initiative);
  for (const item of backlog.items) validateItem(errors, item);

  const initiativeById = new Map<string, BacklogInitiative>();
  const itemById = new Map<string, BacklogItem>();
  const allIds = new Set<string>();

  for (const initiative of backlog.initiatives) {
    if (allIds.has(initiative.id)) errors.push(`duplicate backlog ID: ${initiative.id}`);
    allIds.add(initiative.id);
    initiativeById.set(initiative.id, initiative);
  }
  for (const item of backlog.items) {
    if (allIds.has(item.id)) errors.push(`duplicate backlog ID: ${item.id}`);
    allIds.add(item.id);
    itemById.set(item.id, item);
  }

  for (const initiative of backlog.initiatives) {
    for (const dependency of initiative.dependencies ?? []) {
      if (!initiativeById.has(dependency)) {
        errors.push(`${initiative.id}: unknown initiative dependency ${dependency}`);
      }
      if (dependency === initiative.id) {
        errors.push(`${initiative.id}: cannot depend on itself`);
      }
    }
    for (const itemId of initiative.items ?? []) {
      const item = itemById.get(itemId);
      if (!item) {
        errors.push(`${initiative.id}: unknown item ${itemId}`);
      } else if (item.initiative !== initiative.id) {
        errors.push(`${initiative.id}: item ${itemId} points to ${item.initiative}`);
      }
    }
  }

  for (const item of backlog.items) {
    const initiative = initiativeById.get(item.initiative);
    if (!initiative) {
      errors.push(`${item.id}: unknown initiative ${item.initiative}`);
    } else if (!initiative.items.includes(item.id)) {
      errors.push(`${item.id}: missing from ${initiative.id}.items`);
    }
    for (const dependency of item.dependencies ?? []) {
      if (!itemById.has(dependency)) errors.push(`${item.id}: unknown dependency ${dependency}`);
      if (dependency === item.id) errors.push(`${item.id}: cannot depend on itself`);
    }
  }

  errors.push(...detectCycles(backlog.items));

  const activeItems = backlog.items.filter((item) => item.status === "in-progress");
  if (activeItems.length > 2) errors.push("WIP limit exceeded: more than two in-progress items");
  const activeByInitiative = new Map<string, number>();
  for (const item of activeItems) {
    activeByInitiative.set(item.initiative, (activeByInitiative.get(item.initiative) ?? 0) + 1);
  }
  for (const [initiative, count] of activeByInitiative) {
    if (count > 1) errors.push(`WIP limit exceeded: ${initiative} has ${count} in-progress items`);
  }

  return errors.sort();
}

export function assertBacklogValid(backlog: Backlog): void {
  const errors = validateBacklog(backlog);
  if (errors.length > 0) {
    throw new Error(`backlog validation failed\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
}

const STATUS_ORDER = new Map([
  ["in-progress", 0],
  ["review", 1],
  ["blocked", 2],
  ["ready", 3],
  ["accepted", 4],
  ["proposed", 5],
  ["deferred", 6],
  ["done", 7],
  ["rejected", 8],
]);
const PRIORITY_ORDER = new Map([
  ["P0", 0],
  ["P1", 1],
  ["P2", 2],
  ["P3", 3],
  ["icebox", 4],
]);

function itemOrder(left: BacklogItem, right: BacklogItem) {
  return (
    (STATUS_ORDER.get(left.status) ?? 99) - (STATUS_ORDER.get(right.status) ?? 99) ||
    (PRIORITY_ORDER.get(left.priority) ?? 99) - (PRIORITY_ORDER.get(right.priority) ?? 99) ||
    left.id.localeCompare(right.id)
  );
}

function issueCell(item: BacklogItem) {
  const parts: string[] = [];
  if (item.github.issue) parts.push(`#${item.github.issue}`);
  if (item.github.pr) parts.push(`PR #${item.github.pr}`);
  return parts.length > 0 ? parts.join(", ") : "not mirrored";
}

export function renderBacklogMarkdown(backlog: Backlog): string {
  assertBacklogValid(backlog);
  const focus = [...backlog.items]
    .filter((item) => ["in-progress", "review", "blocked", "ready", "accepted"].includes(item.status))
    .sort(itemOrder)
    .slice(0, 10);
  const counts = new Map<string, number>();
  for (const item of backlog.items) counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  const lines = [
    "# Riqor Backlog",
    "",
    "> Generated from `backlog/initiatives/*.yml` and `backlog/items/*.yml`. Do not edit this file directly.",
    "",
    "## Current Focus",
    "",
    "| ID | Item | Status | Priority | Release | Execution |",
    "| --- | --- | --- | --- | --- | --- |",
    ...focus.map(
      (item) =>
        `| ${item.id} | ${item.title} | ${item.status} | ${item.priority} | ${item.releaseTarget} | ${issueCell(item)} |`,
    ),
    "",
    "## Initiative Map",
    "",
    "| ID | Initiative | Status | Priority | Releases | Items |",
    "| --- | --- | --- | --- | --- | --- |",
    ...backlog.initiatives.map(
      (initiative) =>
        `| ${initiative.id} | ${initiative.title} | ${initiative.status} | ${initiative.priority} | ${initiative.releaseTargets.join(", ")} | ${initiative.items.length} |`,
    ),
    "",
    "## Status Summary",
    "",
    "| Status | Count |",
    "| --- | ---: |",
    ...[...ITEM_STATUSES]
      .filter((status) => counts.has(status))
      .map((status) => `| ${status} | ${counts.get(status)} |`),
    "",
    "## Commands",
    "",
    "```bash",
    "bun run backlog:lint",
    "bun run backlog:report",
    "bun run backlog:sync",
    "bun run backlog:check",
    "```",
    "",
    "## Governance",
    "",
    "- [Operating guide](docs/backlog/README.md)",
    "- [Current development focus](docs/backlog/CURRENT.md)",
    "- [Roadmap](docs/backlog/ROADMAP.md)",
    "- [Triage and lifecycle](docs/backlog/TRIAGE.md)",
    "- [Ecosystem ownership](docs/backlog/ECOSYSTEM_BOUNDARIES.md)",
    "- [Release trains](docs/backlog/RELEASE_TRAINS.md)",
    "",
  ];
  return lines.join("\n");
}

export function renderCurrentMarkdown(backlog: Backlog): string {
  assertBacklogValid(backlog);
  const active = backlog.items.filter((item) => item.status === "in-progress").sort(itemOrder);
  const next = backlog.items
    .filter((item) => ["ready", "accepted"].includes(item.status))
    .sort(itemOrder)
    .slice(0, 8);
  const blocked = backlog.items.filter((item) => item.status === "blocked").sort(itemOrder);
  const lines = [
    "# Current Development Focus",
    "",
    "> Generated from the versioned backlog. Do not edit this file directly.",
    "",
    "## Active Work",
    "",
    ...(active.length > 0
      ? active.map(
          (item) =>
            `- **${item.id} ${item.title}** — ${item.status}, ${item.priority}, target ${item.releaseTarget}, ${issueCell(item)}`,
        )
      : ["- No item is currently in progress"]),
    "",
    "## Next Queue",
    "",
    ...(next.length > 0
      ? next.map(
          (item, index) =>
            `${index + 1}. **${item.id} ${item.title}** — ${item.status}, depends on ${item.dependencies.length > 0 ? item.dependencies.join(", ") : "nothing"}`,
        )
      : ["No accepted or ready item is queued"]),
    "",
    "## Blockers",
    "",
    ...(blocked.length > 0
      ? blocked.map(
          (item) =>
            `- **${item.id}** — ${item.blocked?.reason}; owner ${item.blocked?.owner}; next ${item.blocked?.nextAction}`,
        )
      : ["- No blocked item"]),
    "",
    "## WIP Guardrails",
    "",
    "- One in-progress item per initiative",
    "- Two in-progress runtime items maximum",
    "- One governance or documentation pull request",
    "- One release pull request",
    "- Dependent work waits while the prerequisite phase is in review",
    "",
  ];
  return lines.join("\n");
}

export function repositoryRootFromModule(moduleUrl: string): string {
  return join(dirname(fileURLToPath(moduleUrl)), "..");
}
