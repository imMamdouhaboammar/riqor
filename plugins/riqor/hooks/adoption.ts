import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

type PluginAdoptionEvent = "session" | "agentStart";
type PluginAdoptionLedger = Readonly<{
  schemaVersion: 1;
  installationId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  activeDayCount: number;
  lastActiveDay: string;
  sessions: number;
  agentStarts: number;
}>;

const file = "adoption.json";
const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

async function readLedger(dataDir: string): Promise<PluginAdoptionLedger | undefined> {
  try {
    const value = JSON.parse(await readFile(join(dataDir, file), "utf8")) as PluginAdoptionLedger;
    return value?.schemaVersion === 1 ? value : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function recordPluginAdoption(dataDir: string, event: PluginAdoptionEvent, now = Date.now()) {
  const current = await readLedger(dataDir);
  const timestamp = new Date(now).toISOString();
  const day = utcDay(now);
  const next: PluginAdoptionLedger = {
    schemaVersion: 1,
    installationId: current?.installationId ?? randomUUID(),
    firstSeenAt: current?.firstSeenAt ?? timestamp,
    lastSeenAt: timestamp,
    activeDayCount: (current?.activeDayCount ?? 0) + (current?.lastActiveDay === day ? 0 : 1),
    lastActiveDay: day,
    sessions: (current?.sessions ?? 0) + (event === "session" ? 1 : 0),
    agentStarts: (current?.agentStarts ?? 0) + (event === "agentStart" ? 1 : 0),
  };
  const target = join(dataDir, file);
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  return next;
}
