import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const INITIATIVE_ID = /^RIQ-0(?:0[1-9]|[1-9][0-9])$/;
const ITEM_ID = /^RIQ-[1-9][0-9]{2}$/;
const FILE_ID = /^(RIQ-[0-9]{3})-/;
const RELEASE = /^0\.[0-9]+\.[0-9]+$/;
const PHASE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const INITIATIVE_STATUSES = new Set(["planned", "active", "paused", "complete"]);
const ITEM_STATUSES = new Set(["proposed", "accepted", "ready", "in-progress", "blocked", "review", "done", "deferred", "rejected"]);
const PRIORITIES = new Set(["P0", "P1", "P2", "P3", "icebox"]);
const ITEM_TYPES = new Set(["feature", "integration", "security", "test", "release", "maintenance", "research", "documentation"]);
const COLLABORATORS = new Set(["agent-kernel", "delegate-team", "dokion", "codex-security", "creative"]);
const EVIDENCE_TYPES = new Set(["focused-test", "integration-test", "package-gate", "review", "security-review", "privacy-review", "artifact", "manual-evidence"]);
const RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);
const INSPIRATION_PROJECTS = new Set(["LightAgent", "fable5-mode", "agent-harness", "internal"]);

export type Inspiration = Readonly<{ project: string; concepts: readonly string[] }>;
export type BacklogInitiative = Readonly<{
  schemaVersion: 1;
  id: string;
  title: string;
  status: "planned" | "active" | "paused" | "complete";
  priority: "P0" | "P1" | "P2" | "P3" | "icebox";
  ownerProject: "riqor";
  problem: string;
  outcome: string;
  scope: Readonly<{ included: readonly string[]; excluded: readonly string[] }>;
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
  scope: Readonly<{ included: readonly string[]; excluded: readonly string[] }>;
  dependencies: readonly string[];
  acceptance: readonly Readonly<{ id: string; command: string }>[];
  evidenceRequired: readonly string[];
  risk: Readonly<{ level: string; areas: readonly string[] }>;
  github: Readonly<{ issue: number | null; pr: number | null; milestone: string | null }>;
  releaseTarget: string;
  inspirations: readonly Inspiration[];
  blocked: Readonly<{ reason: string; owner: string; nextAction: string }> | null;
  completion: Readonly<{ mergedPr: number; commit: string; evidence: readonly string[] }> | null;
  sourcePath: string;
}>;
export type Backlog = Readonly<{ initiatives: readonly BacklogInitiative[]; items: readonly BacklogItem[] }>;

type RecordValue = Record<string, unknown>;
type BunYamlRuntime = Readonly<{ Bun?: Readonly<{ YAML?: Readonly<{ parse(input: string): unknown }> }> }>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function isText(value: unknown, minimum = 1): value is string {
  return typeof value === "string" && value.trim().length >= minimum;
}
function parseYaml(input: string, path: string): unknown {
  const parser = (globalThis as BunYamlRuntime).Bun?.YAML?.parse;
  if (!parser) throw new Error("Bun YAML parser is unavailable");
  try {
    const parsed = parser(input);
    if (Array.isArray(parsed)) throw new Error("multi-document YAML is not supported");
    return parsed;
  } catch (error) {
    throw new Error(`${path}: ${(error as Error).message}`);
  }
}
async function loadDirectory(path: string): Promise<Array<{ path: string; value: unknown }>> {
  const names = (await readdir(path)).filter((name) => name.endsWith(".yml")).sort();
  return Promise.all(names.map(async (name) => {
    const file = join(path, name);
    return { path: file, value: parseYaml(await readFile(file, "utf8"), file) };
  }));
}
function withSource<T>(path: string, value: unknown): T {
  return Object.freeze({ ...(isRecord(value) ? value : {}), sourcePath: path }) as T;
}
export async function loadBacklog(root: string): Promise<Backlog> {
  const [initiativeFiles, itemFiles] = await Promise.all([
    loadDirectory(join(root, "backlog", "initiatives")),
    loadDirectory(join(root, "backlog", "items")),
  ]);
  return Object.freeze({
    initiatives: initiativeFiles.map(({ path, value }) => withSource<BacklogInitiative>(path, value)).sort((a, b) => String(a.id).localeCompare(String(b.id))),
    items: itemFiles.map(({ path, value }) => withSource<BacklogItem>(path, value)).sort((a, b) => String(a.id).localeCompare(String(b.id))),
  });
}

function requireCondition(errors: string[], source: string, condition: boolean, message: string) {
  if (!condition) errors.push(`${source}: ${message}`);
}
function validateFilename(errors: string[], source: string, id: unknown) {
  const match = basename(source).match(FILE_ID);
  requireCondition(errors, source, Boolean(match), "filename must start with a backlog ID");
  if (match && typeof id === "string") requireCondition(errors, source, match[1] === id, `filename ID ${match[1]} does not match ${id}`);
}
function validateScope(errors: string[], source: string, value: unknown) {
  requireCondition(errors, source, isRecord(value), "scope must be an object");
  if (!isRecord(value)) return;
  requireCondition(errors, source, isStringArray(value.included) && value.included.length > 0, "scope.included must be a non-empty string array");
  requireCondition(errors, source, isStringArray(value.excluded) && value.excluded.length > 0, "scope.excluded must be a non-empty string array");
}
function validateInspirations(errors: string[], source: string, value: unknown) {
  requireCondition(errors, source, Array.isArray(value) && value.length > 0, "inspirations must be a non-empty array");
  if (!Array.isArray(value)) return;
  value.forEach((entry, index) => {
    const label = `${source} inspiration ${index + 1}`;
    requireCondition(errors, label, isRecord(entry), "must be an object");
    if (!isRecord(entry)) return;
    requireCondition(errors, label, typeof entry.project === "string" && INSPIRATION_PROJECTS.has(entry.project), "has an unknown project");
    requireCondition(errors, label, isStringArray(entry.concepts) && entry.concepts.length > 0, "concepts must be a non-empty string array");
  });
}
function validateCommon(errors: string[], record: BacklogInitiative | BacklogItem) {
  validateFilename(errors, record.sourcePath, record.id);
  requireCondition(errors, record.sourcePath, record.schemaVersion === 1, "schemaVersion must be 1");
  requireCondition(errors, record.sourcePath, isText(record.title, 3), "title is required");
  requireCondition(errors, record.sourcePath, record.ownerProject === "riqor", "ownerProject must be riqor");
  requireCondition(errors, record.sourcePath, isText(record.problem, 20), "problem is too short");
  requireCondition(errors, record.sourcePath, isText(record.outcome, 20), "outcome is too short");
  validateScope(errors, record.sourcePath, record.scope);
  requireCondition(errors, record.sourcePath, isStringArray(record.dependencies), "dependencies must be a string array");
  validateInspirations(errors, record.sourcePath, record.inspirations);
}
function validateInitiative(errors: string[], initiative: BacklogInitiative) {
  const source = initiative.sourcePath;
  validateCommon(errors, initiative);
  requireCondition(errors, source, typeof initiative.id === "string" && INITIATIVE_ID.test(initiative.id), "invalid initiative ID");
  requireCondition(errors, source, INITIATIVE_STATUSES.has(initiative.status), "invalid initiative status");
  requireCondition(errors, source, PRIORITIES.has(initiative.priority), "invalid priority");
  requireCondition(errors, source, isStringArray(initiative.items) && initiative.items.length > 0, "items must be a non-empty string array");
  requireCondition(errors, source, isStringArray(initiative.releaseTargets) && initiative.releaseTargets.length > 0 && initiative.releaseTargets.every((target) => RELEASE.test(target)), "releaseTargets must contain semantic release versions");
  requireCondition(errors, source, isStringArray(initiative.successMetrics) && initiative.successMetrics.length > 0, "successMetrics must be a non-empty string array");
}
function validateItem(errors: string[], item: BacklogItem) {
  const source = item.sourcePath;
  validateCommon(errors, item);
  requireCondition(errors, source, typeof item.id === "string" && ITEM_ID.test(item.id), "invalid item ID");
  requireCondition(errors, source, typeof item.type === "string" && ITEM_TYPES.has(item.type), "invalid item type");
  requireCondition(errors, source, typeof item.status === "string" && ITEM_STATUSES.has(item.status), "invalid item status");
  requireCondition(errors, source, typeof item.priority === "string" && PRIORITIES.has(item.priority), "invalid priority");
  requireCondition(errors, source, typeof item.initiative === "string" && INITIATIVE_ID.test(item.initiative), "invalid initiative reference");
  requireCondition(errors, source, typeof item.phase === "string" && PHASE.test(item.phase), "invalid phase");
  requireCondition(errors, source, isStringArray(item.collaborators) && item.collaborators.every((name) => COLLABORATORS.has(name)), "collaborators contain an unknown project");
  requireCondition(errors, source, Array.isArray(item.acceptance) && item.acceptance.length > 0 && item.acceptance.every((entry) => isRecord(entry) && isText(entry.id, 2) && isText(entry.command, 3)), "acceptance must contain executable commands");
  requireCondition(errors, source, isStringArray(item.evidenceRequired) && item.evidenceRequired.length > 0 && item.evidenceRequired.every((entry) => EVIDENCE_TYPES.has(entry)), "evidenceRequired contains an unknown evidence type");
  requireCondition(errors, source, isRecord(item.risk), "risk must be an object");
  if (isRecord(item.risk)) {
    requireCondition(errors, source, typeof item.risk.level === "string" && RISK_LEVELS.has(item.risk.level), "invalid risk level");
    requireCondition(errors, source, isStringArray(item.risk.areas) && item.risk.areas.length > 0, "risk.areas must be a non-empty string array");
  }
  requireCondition(errors, source, isRecord(item.github), "github must be an object");
  if (isRecord(item.github)) {
    requireCondition(errors, source, item.github.issue === null || (Number.isInteger(item.github.issue) && Number(item.github.issue) > 0), "github.issue must be null or a positive integer");
    requireCondition(errors, source, item.github.pr === null || (Number.isInteger(item.github.pr) && Number(item.github.pr) > 0), "github.pr must be null or a positive integer");
    requireCondition(errors, source, item.github.milestone === null || (typeof item.github.milestone === "string" && RELEASE.test(item.github.milestone)), "github.milestone must be null or a release version");
  }
  requireCondition(errors, source, typeof item.releaseTarget === "string" && RELEASE.test(item.releaseTarget), "invalid releaseTarget");
  if (item.status === "blocked") {
    requireCondition(errors, source, isRecord(item.blocked) && isText(item.blocked.reason, 8) && isText(item.blocked.owner, 2) && isText(item.blocked.nextAction, 8), "blocked items require reason, owner, and nextAction");
  } else requireCondition(errors, source, item.blocked === null, "non-blocked items must set blocked to null");
  if (["in-progress", "review"].includes(item.status)) requireCondition(errors, source, isRecord(item.github) && Number.isInteger(item.github.pr) && Number(item.github.pr) > 0, "in-progress and review items require github.pr");
  if (item.status === "done") requireCondition(errors, source, isRecord(item.completion) && Number.isInteger(item.completion.mergedPr) && typeof item.completion.commit === "string" && /^[a-f0-9]{40}$/.test(item.completion.commit) && isStringArray(item.completion.evidence) && item.completion.evidence.length > 0, "done items require valid completion evidence");
  else requireCondition(errors, source, item.completion === null, "non-done items must set completion to null");
}
function dependencyCycles(items: readonly BacklogItem[]): string[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const active = new Set<string>();
  const done = new Set<string>();
  const errors: string[] = [];
  function visit(id: string, trail: string[]) {
    if (active.has(id)) { errors.push(`dependency cycle: ${[...trail, id].join(" -> ")}`); return; }
    if (done.has(id)) return;
    const item = byId.get(id);
    if (!item) return;
    active.add(id);
    for (const dependency of item.dependencies ?? []) visit(dependency, [...trail, id]);
    active.delete(id);
    done.add(id);
  }
  for (const item of items) visit(item.id, []);
  return errors;
}
export function validateBacklog(backlog: Backlog): string[] {
  const errors: string[] = [];
  backlog.initiatives.forEach((initiative) => validateInitiative(errors, initiative));
  backlog.items.forEach((item) => validateItem(errors, item));
  const initiatives = new Map<string, BacklogInitiative>();
  const items = new Map<string, BacklogItem>();
  const allIds = new Set<string>();
  for (const initiative of backlog.initiatives) {
    if (allIds.has(initiative.id)) errors.push(`duplicate backlog ID: ${initiative.id}`);
    allIds.add(initiative.id); initiatives.set(initiative.id, initiative);
  }
  for (const item of backlog.items) {
    if (allIds.has(item.id)) errors.push(`duplicate backlog ID: ${item.id}`);
    allIds.add(item.id); items.set(item.id, item);
  }
  for (const initiative of backlog.initiatives) {
    for (const dependency of initiative.dependencies ?? []) {
      if (!initiatives.has(dependency)) errors.push(`${initiative.id}: unknown initiative dependency ${dependency}`);
      if (dependency === initiative.id) errors.push(`${initiative.id}: cannot depend on itself`);
    }
    for (const itemId of initiative.items ?? []) {
      const item = items.get(itemId);
      if (!item) errors.push(`${initiative.id}: unknown item ${itemId}`);
      else if (item.initiative !== initiative.id) errors.push(`${initiative.id}: item ${itemId} points to ${item.initiative}`);
    }
  }
  for (const item of backlog.items) {
    const initiative = initiatives.get(item.initiative);
    if (!initiative) errors.push(`${item.id}: unknown initiative ${item.initiative}`);
    else if (!initiative.items.includes(item.id)) errors.push(`${item.id}: missing from ${initiative.id}.items`);
    for (const dependency of item.dependencies ?? []) {
      if (!items.has(dependency)) errors.push(`${item.id}: unknown dependency ${dependency}`);
      if (dependency === item.id) errors.push(`${item.id}: cannot depend on itself`);
    }
  }
  errors.push(...dependencyCycles(backlog.items));
  const inProgress = backlog.items.filter((item) => item.status === "in-progress");
  const byInitiative = new Map<string, number>();
  inProgress.forEach((item) => byInitiative.set(item.initiative, (byInitiative.get(item.initiative) ?? 0) + 1));
  for (const [initiative, count] of byInitiative) if (count > 1) errors.push(`WIP limit exceeded: ${initiative} has ${count} in-progress items`);
  return errors.sort();
}
export function assertBacklogValid(backlog: Backlog): void {
  const errors = validateBacklog(backlog);
  if (errors.length) throw new Error(`backlog validation failed\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

const STATUS_ORDER = new Map(["in-progress", "review", "blocked", "ready", "accepted", "proposed", "deferred", "done", "rejected"].map((status, index) => [status, index]));
const PRIORITY_ORDER = new Map(["P0", "P1", "P2", "P3", "icebox"].map((priority, index) => [priority, index]));
function itemOrder(left: BacklogItem, right: BacklogItem) {
  return (STATUS_ORDER.get(left.status) ?? 99) - (STATUS_ORDER.get(right.status) ?? 99) || (PRIORITY_ORDER.get(left.priority) ?? 99) - (PRIORITY_ORDER.get(right.priority) ?? 99) || left.id.localeCompare(right.id);
}
function issueCell(item: BacklogItem) {
  const parts = [item.github.issue ? `#${item.github.issue}` : "", item.github.pr ? `PR #${item.github.pr}` : ""].filter(Boolean);
  return parts.length ? parts.join(", ") : "not mirrored";
}
export function renderBacklogMarkdown(backlog: Backlog): string {
  assertBacklogValid(backlog);
  const focus = [...backlog.items].filter((item) => ["in-progress", "review", "blocked", "ready", "accepted"].includes(item.status)).sort(itemOrder).slice(0, 10);
  const counts = new Map<string, number>();
  backlog.items.forEach((item) => counts.set(item.status, (counts.get(item.status) ?? 0) + 1));
  return [
    "# Riqor Backlog", "", "> Generated from `backlog/initiatives/*.yml` and `backlog/items/*.yml`. Do not edit this file directly.", "",
    "## Current Focus", "", "| ID | Item | Status | Priority | Release | Execution |", "| --- | --- | --- | --- | --- | --- |",
    ...focus.map((item) => `| ${item.id} | ${item.title} | ${item.status} | ${item.priority} | ${item.releaseTarget} | ${issueCell(item)} |`), "",
    "## Initiative Map", "", "| ID | Initiative | Status | Priority | Releases | Items |", "| --- | --- | --- | --- | --- | --- |",
    ...backlog.initiatives.map((initiative) => `| ${initiative.id} | ${initiative.title} | ${initiative.status} | ${initiative.priority} | ${initiative.releaseTargets.join(", ")} | ${initiative.items.length} |`), "",
    "## Status Summary", "", "| Status | Count |", "| --- | ---: |",
    ...[...ITEM_STATUSES].filter((status) => counts.has(status)).map((status) => `| ${status} | ${counts.get(status)} |`), "",
    "## Commands", "", "```bash", "bun run backlog:lint", "bun run backlog:report", "bun run backlog:sync", "bun run backlog:check", "```", "",
    "## Governance", "", "- [Operating guide](docs/backlog/README.md)", "- [Current development focus](docs/backlog/CURRENT.md)", "- [Roadmap](docs/backlog/ROADMAP.md)", "- [Triage and lifecycle](docs/backlog/TRIAGE.md)", "- [Ecosystem ownership](docs/backlog/ECOSYSTEM_BOUNDARIES.md)", "- [Release trains](docs/backlog/RELEASE_TRAINS.md)", "",
  ].join("\n");
}
export function renderCurrentMarkdown(backlog: Backlog): string {
  assertBacklogValid(backlog);
  const active = backlog.items.filter((item) => item.status === "in-progress").sort(itemOrder);
  const next = backlog.items.filter((item) => ["ready", "accepted"].includes(item.status)).sort(itemOrder).slice(0, 8);
  const blocked = backlog.items.filter((item) => item.status === "blocked").sort(itemOrder);
  return [
    "# Current Development Focus", "", "> Generated from the versioned backlog. Do not edit this file directly.", "", "## Active Work", "",
    ...(active.length ? active.map((item) => `- **${item.id} ${item.title}** — ${item.status}, ${item.priority}, target ${item.releaseTarget}, ${issueCell(item)}`) : ["- No item is currently in progress"]), "",
    "## Next Queue", "", ...(next.length ? next.map((item, index) => `${index + 1}. **${item.id} ${item.title}** — ${item.status}, depends on ${item.dependencies.length ? item.dependencies.join(", ") : "nothing"}`) : ["No accepted or ready item is queued"]), "",
    "## Blockers", "", ...(blocked.length ? blocked.map((item) => `- **${item.id}** — ${item.blocked?.reason}; owner ${item.blocked?.owner}; next ${item.blocked?.nextAction}`) : ["- No blocked item"]), "",
    "## WIP Guardrails", "", "- One in-progress item per initiative", "- Two in-progress runtime items maximum", "- One governance or documentation pull request", "- One release pull request", "- Dependent work waits while the prerequisite phase is in review", "",
  ].join("\n");
}
export function repositoryRootFromModule(moduleUrl: string): string {
  return join(dirname(fileURLToPath(moduleUrl)), "..");
}
