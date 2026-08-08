import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface SessionHeartbeat {
  sessionId: string;
  pid: number;
  lastHeartbeat: string;
  active: boolean;
}

export interface ScratchpadEntry {
  key: string;
  value: unknown;
  updatedAt: string;
}

export function getRiqorStorageDir(repoRoot: string = process.cwd()): string {
  const dir = join(resolve(repoRoot), ".riqor");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function recordHeartbeat(sessionId: string, repoRoot: string = process.cwd()): SessionHeartbeat {
  const storageDir = getRiqorStorageDir(repoRoot);
  const heartbeatsDir = join(storageDir, "heartbeats");
  if (!existsSync(heartbeatsDir)) {
    mkdirSync(heartbeatsDir, { recursive: true });
  }

  const heartbeat: SessionHeartbeat = {
    sessionId,
    pid: process.pid,
    lastHeartbeat: new Date().toISOString(),
    active: true,
  };

  const file = join(heartbeatsDir, `${sessionId}.json`);
  writeFileSync(file, JSON.stringify(heartbeat, null, 2), "utf8");
  return heartbeat;
}

export function listActiveSessions(repoRoot: string = process.cwd(), ttlMs: number = 300_000): SessionHeartbeat[] {
  const storageDir = getRiqorStorageDir(repoRoot);
  const heartbeatsDir = join(storageDir, "heartbeats");
  if (!existsSync(heartbeatsDir)) return [];

  const now = Date.now();
  const activeSessions: SessionHeartbeat[] = [];

  for (const filename of readdirSync(heartbeatsDir)) {
    if (!filename.endsWith(".json")) continue;
    const filePath = join(heartbeatsDir, filename);
    try {
      const data = JSON.parse(readFileSync(filePath, "utf8")) as SessionHeartbeat;
      const age = now - new Date(data.lastHeartbeat).getTime();
      if (age <= ttlMs) {
        activeSessions.push(data);
      } else {
        rmSync(filePath, { force: true });
      }
    } catch {
      rmSync(filePath, { force: true });
    }
  }

  return activeSessions;
}

export function writeScratchpadEntry(
  sessionId: string,
  key: string,
  value: unknown,
  repoRoot: string = process.cwd(),
): ScratchpadEntry {
  const storageDir = getRiqorStorageDir(repoRoot);
  const scratchpadsDir = join(storageDir, "scratchpads");
  if (!existsSync(scratchpadsDir)) {
    mkdirSync(scratchpadsDir, { recursive: true });
  }

  const file = join(scratchpadsDir, `${sessionId}.json`);
  let entries: Record<string, ScratchpadEntry> = {};
  if (existsSync(file)) {
    try {
      entries = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      entries = {};
    }
  }

  const entry: ScratchpadEntry = {
    key,
    value,
    updatedAt: new Date().toISOString(),
  };

  entries[key] = entry;
  writeFileSync(file, JSON.stringify(entries, null, 2), "utf8");
  return entry;
}

export function readScratchpad(sessionId: string, repoRoot: string = process.cwd()): Record<string, ScratchpadEntry> {
  const storageDir = getRiqorStorageDir(repoRoot);
  const file = join(storageDir, "scratchpads", `${sessionId}.json`);
  if (!existsSync(file)) return {};

  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}
