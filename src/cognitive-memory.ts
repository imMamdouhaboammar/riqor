import { createHash } from "node:crypto";
import { readFile, writeFile, chmod, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

export type MemoryCategory = "architecture" | "failure-pattern" | "convention" | "guardrail";

export type CognitiveMemoryEntry = Readonly<{
  id: string;
  projectDigest: string;
  category: MemoryCategory;
  title: string;
  pattern: string;
  timestamp: string;
}>;

export class CognitiveMemoryLedger {
  private readonly storagePath: string;
  private readonly maxCapacity: number;

  constructor(dataDirectory: string, maxCapacity = 50) {
    this.storagePath = join(dataDirectory, "cognitive-memory.json");
    this.maxCapacity = maxCapacity;
  }

  public getStoragePath(): string {
    return this.storagePath;
  }

  private hashProject(projectRoot: string): string {
    return createHash("sha256").update(projectRoot.trim().toLowerCase()).digest("hex");
  }

  private async loadEntries(): Promise<CognitiveMemoryEntry[]> {
    try {
      const data = await readFile(this.storagePath, "utf8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed as CognitiveMemoryEntry[];
      }
      return [];
    } catch {
      return [];
    }
  }

  private async saveEntries(entries: CognitiveMemoryEntry[]): Promise<void> {
    await mkdir(dirname(this.storagePath), { recursive: true });
    const content = JSON.stringify(entries, null, 2);
    await writeFile(this.storagePath, content, { mode: 0o600 });
    await chmod(this.storagePath, 0o600).catch(() => {});
  }

  public async addEntry(
    projectRoot: string,
    payload: { category: MemoryCategory; title: string; pattern: string },
  ): Promise<CognitiveMemoryEntry> {
    const projectDigest = this.hashProject(projectRoot);
    const existing = await this.loadEntries();

    const newEntry: CognitiveMemoryEntry = Object.freeze({
      id: createHash("sha256").update(`${projectDigest}:${Date.now()}:${payload.title}`).digest("hex").slice(0, 16),
      projectDigest,
      category: payload.category,
      title: payload.title.slice(0, 200),
      pattern: payload.pattern.slice(0, 1000),
      timestamp: new Date().toISOString(),
    });

    const updated = [...existing, newEntry];

    // Prune for this project digest if over capacity
    const projectEntries = updated.filter((e) => e.projectDigest === projectDigest);
    if (projectEntries.length > this.maxCapacity) {
      const overflowCount = projectEntries.length - this.maxCapacity;
      let removed = 0;
      const pruned = updated.filter((e) => {
        if (e.projectDigest === projectDigest && removed < overflowCount) {
          removed++;
          return false;
        }
        return true;
      });
      await this.saveEntries(pruned);
    } else {
      await this.saveEntries(updated);
    }

    return newEntry;
  }

  public async getEntriesForProject(
    projectRoot: string,
    category?: MemoryCategory,
  ): Promise<readonly CognitiveMemoryEntry[]> {
    const projectDigest = this.hashProject(projectRoot);
    const entries = await this.loadEntries();
    return entries.filter(
      (e) => e.projectDigest === projectDigest && (!category || e.category === category),
    );
  }
}
