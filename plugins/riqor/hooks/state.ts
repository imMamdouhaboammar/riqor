import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readdir, readFile, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type MutationKind = "code" | "docs" | "config" | "unknown";
export type VerificationScope = "code" | "docs";

type TurnState = {
  version: 1;
  mutationKind: MutationKind;
  mutatedAt: number;
  verifiedAt?: number;
  blockedOnce: boolean;
};

const mutationKinds = new Set<MutationKind>(["code", "docs", "config", "unknown"]);
const keyPattern = /^[a-f0-9]{64}$/;
const lockRetryMs = 5;
const lockAttempts = 40;

export function turnKey(input: Record<string, unknown>) {
  return createHash("sha256")
    .update(`${String(input.session_id ?? "unknown")}\0${String(input.turn_id ?? "unknown")}`)
    .digest("hex");
}

function statePath(dataDir: string, key: string) {
  if (!keyPattern.test(key)) throw new Error("invalid state key");
  return join(dataDir, `${key}.json`);
}

async function secureDataDir(dataDir: string) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const info = await lstat(dataDir);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("PLUGIN_DATA must be a real directory");
  await chmod(dataDir, 0o700);
}

function lockPath(dataDir: string, key: string) {
  if (!keyPattern.test(key)) throw new Error("invalid state key");
  return join(dataDir, `.${key}.lock`);
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const lockLeaseMs = 60_000;
const lockHardExpiryMs = 24 * 60 * 60 * 1000;

type LockOwner = Readonly<{
  version: 1;
  token: string;
  pid: number;
  createdAt: number;
}>;

type TurnLock = Readonly<{ path: string; ownerPath: string; token: string }>;

function parseLockOwner(contents: string): LockOwner | undefined {
  try {
    const owner = JSON.parse(contents) as Partial<LockOwner>;
    if (owner.version !== 1) return undefined;
    if (typeof owner.token !== "string" || owner.token.length < 1 || owner.token.length > 128) return undefined;
    if (!Number.isInteger(owner.pid) || Number(owner.pid) <= 0) return undefined;
    if (!validTime(owner.createdAt)) return undefined;
    return owner as LockOwner;
  } catch {
    return undefined;
  }
}

async function readLockOwner(path: string) {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 512) return undefined;
    return parseLockOwner(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function processIsAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function recoverAbandonedLock(path: string) {
  let directoryInfo;
  try {
    directoryInfo = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) return false;

  const ownerPath = join(path, "owner.json");
  const observedOwner = await readLockOwner(ownerPath);
  const observedAt = observedOwner?.createdAt ?? directoryInfo.mtimeMs;
  const observedAge = Date.now() - observedAt;
  if (observedAge <= lockLeaseMs) return false;
  if (observedOwner && observedAge <= lockHardExpiryMs && processIsAlive(observedOwner.pid)) return false;

  const recoveryPath = join(path, ".recovery.json");
  const recoveryToken = randomUUID();
  const staleMarker = await readLockOwner(recoveryPath);
  if (staleMarker) {
    const markerAge = Date.now() - staleMarker.createdAt;
    if (markerAge > lockLeaseMs && (markerAge > lockHardExpiryMs || !processIsAlive(staleMarker.pid))) {
      const confirmedMarker = await readLockOwner(recoveryPath);
      if (confirmedMarker?.token === staleMarker.token) await rm(recoveryPath, { force: true });
    }
  }
  try {
    await writeFile(recoveryPath, `${JSON.stringify({ version: 1, token: recoveryToken, pid: process.pid, createdAt: Date.now() })}
`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }

  try {
    const currentOwner = await readLockOwner(ownerPath);
    if (observedOwner && currentOwner?.token !== observedOwner.token) return false;
    if (currentOwner) {
      const currentAge = Date.now() - currentOwner.createdAt;
      if (currentAge <= lockLeaseMs) return false;
      if (currentAge <= lockHardExpiryMs && processIsAlive(currentOwner.pid)) return false;
    }
    await rm(ownerPath, { force: true });
  } finally {
    const recovery = await readLockOwner(recoveryPath);
    if (recovery?.token === recoveryToken) await rm(recoveryPath, { force: true });
  }

  try {
    await rmdir(path);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return true;
    if (code === "ENOTEMPTY" || code === "EEXIST") return false;
    throw error;
  }
}

async function acquireTurnLock(dataDir: string, key: string): Promise<TurnLock> {
  await secureDataDir(dataDir);
  const path = lockPath(dataDir, key);
  const ownerPath = join(path, "owner.json");
  const token = randomUUID();
  for (let attempt = 0; attempt < lockAttempts; attempt += 1) {
    try {
      await mkdir(path, { mode: 0o700 });
      try {
        await writeFile(ownerPath, `${JSON.stringify({ version: 1, token, pid: process.pid, createdAt: Date.now() })}
`, {
          encoding: "utf8",
          flag: "wx",
          mode: 0o600,
        });
      } catch (error) {
        await rm(ownerPath, { force: true });
        await rmdir(path).catch(() => undefined);
        throw error;
      }
      return { path, ownerPath, token };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      await recoverAbandonedLock(path);
      await delay(lockRetryMs);
    }
  }
  throw new Error("timed out acquiring turn state lock");
}

async function releaseTurnLock(lock: TurnLock) {
  const owner = await readLockOwner(lock.ownerPath);
  if (owner?.token !== lock.token) return;
  await rm(lock.ownerPath, { force: true });
  try {
    await rmdir(lock.path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "ENOTEMPTY" && code !== "EEXIST") throw error;
  }
}

async function withTurnLock<T>(dataDir: string, key: string, operation: () => Promise<T>) {
  const lock = await acquireTurnLock(dataDir, key);
  try {
    return await operation();
  } finally {
    await releaseTurnLock(lock);
  }
}

function validTime(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseState(contents: string): TurnState | undefined {
  try {
    const candidate = JSON.parse(contents) as Partial<TurnState>;
    if (candidate.version !== 1) return undefined;
    if (!mutationKinds.has(candidate.mutationKind as MutationKind)) return undefined;
    if (!validTime(candidate.mutatedAt)) return undefined;
    if (candidate.verifiedAt !== undefined && !validTime(candidate.verifiedAt)) return undefined;
    if (typeof candidate.blockedOnce !== "boolean") return undefined;
    return candidate as TurnState;
  } catch {
    return undefined;
  }
}

async function readState(dataDir: string, key: string) {
  const path = statePath(dataDir, key);
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 512) {
      await rm(path, { force: true });
      return undefined;
    }
    const state = parseState(await readFile(path, "utf8"));
    if (!state) await rm(path, { force: true });
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function writeState(dataDir: string, key: string, state: TurnState) {
  await secureDataDir(dataDir);
  const path = statePath(dataDir, key);
  const temporary = join(dataDir, `.${key}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(state)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function markRuntimeSeen(dataDir: string, now = Date.now()) {
  await secureDataDir(dataDir);
  const path = join(dataDir, "runtime.json");
  const temporary = join(dataDir, `.runtime.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify({ version: 1, event: "SessionStart", lastSeenAt: now })}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function recordMutation(dataDir: string, key: string, mutationKind: MutationKind, now = Date.now()) {
  if (!mutationKinds.has(mutationKind)) throw new Error("invalid mutation kind");
  await withTurnLock(dataDir, key, () =>
    writeState(dataDir, key, { version: 1, mutationKind, mutatedAt: now, blockedOnce: false })
  );
}

function scopeCovers(mutationKind: MutationKind, scope: VerificationScope) {
  return scope === "code" || mutationKind === "docs";
}

export async function recordVerification(
  dataDir: string,
  key: string,
  now = Date.now(),
  scope: VerificationScope = "code",
) {
  await withTurnLock(dataDir, key, async () => {
    const current = await readState(dataDir, key);
    if (!current || !scopeCovers(current.mutationKind, scope)) return;
    await writeState(dataDir, key, { ...current, verifiedAt: now, blockedOnce: false });
  });
}

async function clearTurnUnlocked(dataDir: string, key: string) {
  await rm(statePath(dataDir, key), { force: true });
}

export async function consumeEvidenceGate(dataDir: string, key: string) {
  return withTurnLock(dataDir, key, async () => {
    const current = await readState(dataDir, key);
    if (!current) return { pending: false } as const;
    if (current.verifiedAt !== undefined && current.verifiedAt >= current.mutatedAt) {
      await clearTurnUnlocked(dataDir, key);
      return { pending: false } as const;
    }
    if (!current.blockedOnce) {
      await writeState(dataDir, key, { ...current, blockedOnce: true });
      return { pending: true, firstBlock: true, mutationKind: current.mutationKind } as const;
    }
    return { pending: true, firstBlock: false, mutationKind: current.mutationKind } as const;
  });
}

export async function clearTurn(dataDir: string, key: string) {
  await withTurnLock(dataDir, key, () => clearTurnUnlocked(dataDir, key));
}

type PruneCandidate = Readonly<{ key: string; path: string; modifiedAt: number }>;

type LockAttempt<T> = Readonly<{ acquired: true; value: T }> | Readonly<{ acquired: false }>;

async function tryWithTurnLock<T>(dataDir: string, key: string, operation: () => Promise<T>): Promise<LockAttempt<T>> {
  try {
    return { acquired: true, value: await withTurnLock(dataDir, key, operation) };
  } catch (error) {
    if (error instanceof Error && error.message === "timed out acquiring turn state lock") return { acquired: false };
    throw error;
  }
}

async function inspectPruneCandidateUnlocked(
  dataDir: string,
  key: string,
  removeInvalid: boolean,
): Promise<PruneCandidate | undefined> {
  const path = statePath(dataDir, key);
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 512) {
      if (removeInvalid) await rm(path, { force: true });
      return undefined;
    }
    const state = parseState(await readFile(path, "utf8"));
    if (!state) {
      if (removeInvalid) await rm(path, { force: true });
      return undefined;
    }
    return {
      key,
      path,
      modifiedAt: Math.max(state.mutatedAt, state.verifiedAt ?? 0, info.mtimeMs),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function pruneState(
  dataDir: string,
  now = Date.now(),
  limits: { maxAgeMs?: number; maxFiles?: number } = {},
) {
  await secureDataDir(dataDir);
  const maxAgeMs = Math.max(0, limits.maxAgeMs ?? 14 * 24 * 60 * 60 * 1000);
  const maxFiles = Math.max(0, Math.floor(limits.maxFiles ?? 256));
  const candidates: PruneCandidate[] = [];

  for (const name of await readdir(dataDir)) {
    const match = name.match(/^([a-f0-9]{64})\.json$/);
    if (!match) continue;
    const key = match[1]!;
    const attempt = await tryWithTurnLock(dataDir, key, async () => {
      const current = await inspectPruneCandidateUnlocked(dataDir, key, true);
      if (!current) return undefined;
      if (now - current.modifiedAt > maxAgeMs) {
        await rm(current.path, { force: true });
        return undefined;
      }
      return current;
    });
    if (attempt.acquired && attempt.value) candidates.push(attempt.value);
  }

  candidates.sort((left, right) => right.modifiedAt - left.modifiedAt || left.key.localeCompare(right.key));
  let survivorRank = 0;
  for (const candidate of candidates) {
    const attempt = await tryWithTurnLock(dataDir, candidate.key, async () => {
      const current = await inspectPruneCandidateUnlocked(dataDir, candidate.key, true);
      if (!current) return false;
      if (now - current.modifiedAt > maxAgeMs) {
        await rm(current.path, { force: true });
        return true;
      }
      if (current.modifiedAt !== candidate.modifiedAt) {
        survivorRank += 1;
        return false;
      }
      if (survivorRank < maxFiles) {
        survivorRank += 1;
        return false;
      }
      await rm(current.path, { force: true });
      return true;
    });
    if (!attempt.acquired) survivorRank += 1;
  }
}
