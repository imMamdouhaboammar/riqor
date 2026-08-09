import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export type AdoptionEventKind = "install" | "session" | "agentStart" | "skill";
export type AdoptionLedger = Readonly<{
  schemaVersion: 1;
  installationId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  firstSeenVersion: string;
  currentVersion: string;
  activeDayCount: number;
  lastActiveDay: string;
  sessions: number;
  agentStarts: number;
  skillInvocations: Readonly<Record<string, number>>;
  versionsSeen: readonly string[];
}>;

const filename = "adoption.json";
const skillPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const pathFor = (stateDir: string) => join(resolve(stateDir), filename);
const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

async function atomicJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function readAdoptionLedger(stateDir: string): Promise<AdoptionLedger | undefined> {
  try {
    const value = JSON.parse(await readFile(pathFor(stateDir), "utf8")) as AdoptionLedger;
    return value?.schemaVersion === 1 ? value : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function recordAdoptionEvent(input: { stateDir: string; version: string; kind: AdoptionEventKind; skill?: string; now?: number }): Promise<AdoptionLedger> {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(input.version)) throw new Error("adoption version must be semver");
  if (input.kind === "skill" && (!input.skill || !skillPattern.test(input.skill))) throw new Error("skill adoption event requires a valid skill slug");
  const now = input.now ?? Date.now();
  const timestamp = new Date(now).toISOString();
  const day = utcDay(now);
  const current = await readAdoptionLedger(input.stateDir);
  const skillInvocations = { ...(current?.skillInvocations ?? {}) };
  if (input.kind === "skill") skillInvocations[input.skill!] = (skillInvocations[input.skill!] ?? 0) + 1;
  const versionsSeen = current?.versionsSeen.includes(input.version)
    ? [...current.versionsSeen]
    : [...(current?.versionsSeen ?? []), input.version];
  const ledger: AdoptionLedger = {
    schemaVersion: 1,
    installationId: current?.installationId ?? randomUUID(),
    firstSeenAt: current?.firstSeenAt ?? timestamp,
    lastSeenAt: timestamp,
    firstSeenVersion: current?.firstSeenVersion ?? input.version,
    currentVersion: input.version,
    activeDayCount: (current?.activeDayCount ?? 0) + (current?.lastActiveDay === day ? 0 : 1),
    lastActiveDay: day,
    sessions: (current?.sessions ?? 0) + (input.kind === "session" ? 1 : 0),
    agentStarts: (current?.agentStarts ?? 0) + (input.kind === "agentStart" ? 1 : 0),
    skillInvocations,
    versionsSeen,
  };
  await atomicJson(pathFor(input.stateDir), ledger);
  return ledger;
}

function bucket(value: number) {
  if (value === 0) return "0";
  if (value < 5) return "1-4";
  if (value < 20) return "5-19";
  if (value < 50) return "20-49";
  if (value < 100) return "50-99";
  if (value < 250) return "100-249";
  return "250+";
}

export async function adoptionReport(stateDir: string): Promise<Record<string, unknown>> {
  const ledger = await readAdoptionLedger(stateDir);
  if (!ledger) return { observed: false, marketplaceInstalls: "unknown", sessions: 0, activeDays: 0, agentStarts: 0, skillInvocations: 0, topSkills: [] };
  const skills = Object.entries(ledger.skillInvocations).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    observed: true,
    marketplaceInstalls: "unknown",
    firstSeenAt: ledger.firstSeenAt,
    lastSeenAt: ledger.lastSeenAt,
    firstSeenVersion: ledger.firstSeenVersion,
    currentVersion: ledger.currentVersion,
    activeDays: ledger.activeDayCount,
    sessions: ledger.sessions,
    agentStarts: ledger.agentStarts,
    skillInvocations: skills.reduce((sum, [, count]) => sum + count, 0),
    topSkills: skills.slice(0, 5).map(([name, invocations]) => ({ name, invocations })),
  };
}

export function formatAdoptionReport(report: Record<string, unknown>): string {
  const rows = [
    "Riqor Local Adoption",
    "",
    `Marketplace installs  ${String(report.marketplaceInstalls ?? "unknown")}`,
    `Local active days     ${String(report.activeDays ?? 0)}`,
    `Local sessions        ${String(report.sessions ?? 0)}`,
    `Local agent starts    ${String(report.agentStarts ?? 0)}`,
    `Observed Skill uses   ${String(report.skillInvocations ?? 0)}`,
    "",
    "Marketplace installs are not inferred from local data",
    "No network telemetry is sent by Riqor",
  ];
  return rows.join("\n");
}

export async function exportAdoptionReceipt(input: { stateDir: string; outputPath: string }): Promise<Record<string, unknown>> {
  const ledger = await readAdoptionLedger(input.stateDir);
  if (!ledger) throw new Error("no local adoption ledger exists");
  const skills = Object.entries(ledger.skillInvocations).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const receipt = {
    schemaVersion: 1,
    product: "riqor",
    currentVersion: ledger.currentVersion,
    firstSeenMonth: ledger.firstSeenAt.slice(0, 7),
    activeDaysBucket: bucket(ledger.activeDayCount),
    sessionsBucket: bucket(ledger.sessions),
    agentStartsBucket: bucket(ledger.agentStarts),
    skillInvocationsBucket: bucket(skills.reduce((sum, [, count]) => sum + count, 0)),
    topSkills: skills.slice(0, 5).map(([name]) => name),
  };
  await atomicJson(resolve(input.outputPath), receipt);
  return receipt;
}

export async function resetAdoption(stateDir: string): Promise<void> {
  await rm(pathFor(stateDir), { force: true });
}
