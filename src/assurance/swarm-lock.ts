import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

export interface SwarmLockOptions {
  lockName: string;
  lockDir: string;
  ownerId: string;
  ttlMs?: number;
}

export interface SwarmLockResult {
  acquired: boolean;
  lockName: string;
  lockPath: string;
  ownerId: string;
  acquiredAt: number;
  ttlMs: number;
  token?: string;
}

interface SwarmLockPayload {
  ownerId: string;
  acquiredAt: number;
  ttlMs: number;
  token: string;
}

const DEFAULT_TTL_MS = 30000;
const MAX_ACQUIRE_ATTEMPTS = 5;

function getLockFilePath(lockDir: string, lockName: string): string {
  const safeName = lockName.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(lockDir, `${safeName}.lock`);
}

function failedResult(
  lockName: string,
  lockPath: string,
  fallbackOwnerId: string,
  fallbackTtlMs: number,
  existing: SwarmLockPayload | null,
): SwarmLockResult {
  return {
    acquired: false,
    lockName,
    lockPath,
    ownerId: existing?.ownerId ?? fallbackOwnerId,
    acquiredAt: existing?.acquiredAt ?? Date.now(),
    ttlMs: existing?.ttlMs ?? fallbackTtlMs,
    ...(existing?.token ? { token: existing.token } : {}),
  };
}

async function tryCreateLock(
  lockPath: string,
  payload: SwarmLockPayload,
): Promise<boolean> {
  try {
    const handle = await open(lockPath, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(payload)}\n`, "utf8");
    } finally {
      await handle.close();
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}

function isExpired(payload: SwarmLockPayload, now = Date.now()): boolean {
  return now - payload.acquiredAt > payload.ttlMs;
}

export async function acquireSwarmLock(options: SwarmLockOptions): Promise<SwarmLockResult> {
  const { lockName, lockDir, ownerId, ttlMs = DEFAULT_TTL_MS } = options;
  if (!ownerId.trim()) throw new Error("swarm lock ownerId is required");
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error("swarm lock ttlMs must be positive");

  await mkdir(lockDir, { recursive: true, mode: 0o700 });
  const lockPath = getLockFilePath(lockDir, lockName);
  const recoveryPath = `${lockPath}.recovery`;

  for (let attempt = 0; attempt < MAX_ACQUIRE_ATTEMPTS; attempt += 1) {
    const now = Date.now();
    const payload: SwarmLockPayload = {
      ownerId,
      acquiredAt: now,
      ttlMs,
      token: randomUUID(),
    };

    if (await tryCreateLock(lockPath, payload)) {
      return {
        acquired: true,
        lockName,
        lockPath,
        ownerId,
        acquiredAt: now,
        ttlMs,
        token: payload.token,
      };
    }

    const existing = await readLockPayload(lockPath);
    if (existing && !isExpired(existing, now)) {
      return failedResult(lockName, lockPath, ownerId, ttlMs, existing);
    }

    let recoveryOwned = false;
    try {
      await mkdir(recoveryPath, { mode: 0o700 });
      recoveryOwned = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }

    if (!recoveryOwned) {
      await new Promise((resolve) => setTimeout(resolve, 2));
      continue;
    }

    try {
      const current = await readLockPayload(lockPath);
      if (!current || isExpired(current)) {
        await rm(lockPath, { force: true });
      } else {
        return failedResult(lockName, lockPath, ownerId, ttlMs, current);
      }
    } finally {
      await rm(recoveryPath, { recursive: true, force: true });
    }
  }

  return failedResult(lockName, lockPath, ownerId, ttlMs, await readLockPayload(lockPath));
}

export async function releaseSwarmLock(lock: SwarmLockResult): Promise<boolean> {
  if (!lock.acquired || !lock.token) return false;

  try {
    const current = await readLockPayload(lock.lockPath);
    if (current && current.ownerId === lock.ownerId && current.token === lock.token) {
      await rm(lock.lockPath, { force: true });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function isSwarmLockActive(options: Omit<SwarmLockOptions, "ownerId">): Promise<boolean> {
  const lockPath = getLockFilePath(options.lockDir, options.lockName);
  const payload = await readLockPayload(lockPath);
  return payload ? !isExpired(payload) : false;
}

async function readLockPayload(lockPath: string): Promise<SwarmLockPayload | null> {
  try {
    const info = await lstat(lockPath);
    if (!info.isFile() || info.isSymbolicLink()) return null;
    const content = await readFile(lockPath, "utf8");
    const parsed = JSON.parse(content) as Partial<SwarmLockPayload>;
    if (
      typeof parsed.ownerId !== "string" || !parsed.ownerId ||
      typeof parsed.acquiredAt !== "number" || !Number.isFinite(parsed.acquiredAt) ||
      typeof parsed.ttlMs !== "number" || !Number.isFinite(parsed.ttlMs) || parsed.ttlMs <= 0 ||
      typeof parsed.token !== "string" || !parsed.token
    ) return null;
    return parsed as SwarmLockPayload;
  } catch {
    return null;
  }
}
