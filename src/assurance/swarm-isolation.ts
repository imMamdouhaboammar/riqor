import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { acquireSwarmLock, releaseSwarmLock, type SwarmLockResult } from "./swarm-lock.js";

export interface SwarmSessionOptions {
  sessionId: string;
  baseDir: string;
  ttlMs?: number;
}

export interface IsolatedWorkspaceInfo {
  sessionId: string;
  workspaceDir: string;
  locksDir: string;
  scratchpadDir: string;
}

export class SwarmSessionIsolation {
  private sessionId: string;
  private baseDir: string;
  private workspaceDir: string;
  private locksDir: string;
  private scratchpadDir: string;
  private activeLocks: Map<string, SwarmLockResult> = new Map();

  constructor(options: SwarmSessionOptions) {
    this.sessionId = options.sessionId;
    this.baseDir = options.baseDir;
    this.workspaceDir = join(this.baseDir, "agents", this.sessionId);
    this.locksDir = join(this.workspaceDir, "locks");
    this.scratchpadDir = join(this.workspaceDir, "scratchpad");
  }

  public async initializeWorkspace(): Promise<IsolatedWorkspaceInfo> {
    await mkdir(this.workspaceDir, { recursive: true });
    await mkdir(this.locksDir, { recursive: true });
    await mkdir(this.scratchpadDir, { recursive: true });

    return {
      sessionId: this.sessionId,
      workspaceDir: this.workspaceDir,
      locksDir: this.locksDir,
      scratchpadDir: this.scratchpadDir,
    };
  }

  public async acquireScopedLock(lockName: string, ttlMs = 30000): Promise<SwarmLockResult> {
    const scopedLockName = `${lockName}__${this.sessionId}`;
    const result = await acquireSwarmLock({
      lockName: scopedLockName,
      lockDir: this.locksDir,
      ownerId: this.sessionId,
      ttlMs,
    });

    if (result.acquired) {
      this.activeLocks.set(lockName, result);
    }
    return result;
  }

  public async releaseScopedLock(lockName: string): Promise<boolean> {
    const lock = this.activeLocks.get(lockName);
    if (!lock) return false;

    const released = await releaseSwarmLock(lock);
    if (released) {
      this.activeLocks.delete(lockName);
    }
    return released;
  }

  public async cleanup(): Promise<void> {
    for (const lockName of Array.from(this.activeLocks.keys())) {
      await this.releaseScopedLock(lockName);
    }
    await rm(this.workspaceDir, { recursive: true, force: true });
  }
}
