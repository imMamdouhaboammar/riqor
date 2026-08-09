import { lstat, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { acquireSwarmLock, releaseSwarmLock } from "./swarm-lock.js";
import { join } from "node:path";

export type ExecutionPhase =
  | "Discovery"
  | "Specification"
  | "TestPlan"
  | "Implementation"
  | "VerificationGate";

export const PHASE_ORDER: ExecutionPhase[] = [
  "Discovery",
  "Specification",
  "TestPlan",
  "Implementation",
  "VerificationGate",
];

export interface PhaseRecord {
  phase: ExecutionPhase;
  timestamp: number;
  artifactPath?: string;
  summary?: string;
}

export interface ExecutionCard {
  cardId: string;
  featureTitle: string;
  owner: string;
  currentPhase: ExecutionPhase;
  createdAt: number;
  updatedAt: number;
  history: PhaseRecord[];
}

export interface CreateCardOptions {
  cardId: string;
  storageDir: string;
  featureTitle: string;
  owner: string;
}

export interface AdvancePhaseOptions {
  cardId: string;
  storageDir: string;
  targetPhase: ExecutionPhase;
  artifactPath: string;
  summary: string;
}

export interface AdvancePhaseResult {
  success: boolean;
  card?: ExecutionCard;
  error?: string;
}

function getCardFilePath(storageDir: string, cardId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(cardId)) {
    throw new Error("cardId must use 1-128 alphanumeric, underscore, or hyphen characters");
  }
  return join(storageDir, `${cardId}.card.json`);
}

async function createCardFile(path: string, card: ExecutionCard): Promise<void> {
  try {
    const handle = await open(path, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(card, null, 2)}\n`, "utf8");
    } finally {
      await handle.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`execution card already exists: ${card.cardId}`);
    }
    throw error;
  }
}

async function replaceCardFile(path: string, card: ExecutionCard): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(card, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function createExecutionCard(options: CreateCardOptions): Promise<ExecutionCard> {
  const { cardId, storageDir, featureTitle, owner } = options;
  await mkdir(storageDir, { recursive: true, mode: 0o700 });

  const now = Date.now();
  const initialPhase: ExecutionPhase = "Discovery";

  const card: ExecutionCard = {
    cardId,
    featureTitle,
    owner,
    currentPhase: initialPhase,
    createdAt: now,
    updatedAt: now,
    history: [{ phase: initialPhase, timestamp: now, summary: "Card created in Discovery" }],
  };

  const cardPath = getCardFilePath(storageDir, cardId);
  await createCardFile(cardPath, card);

  return card;
}

export async function getExecutionCard(cardId: string, storageDir: string): Promise<ExecutionCard | null> {
  try {
    const cardPath = getCardFilePath(storageDir, cardId);
    const info = await lstat(cardPath);
    if (!info.isFile() || info.isSymbolicLink()) return null;
    const content = await readFile(cardPath, "utf-8");
    return JSON.parse(content) as ExecutionCard;
  } catch {
    return null;
  }
}

export async function advanceCardPhase(options: AdvancePhaseOptions): Promise<AdvancePhaseResult> {
  const { cardId, storageDir, targetPhase, artifactPath, summary } = options;
  const lock = await acquireSwarmLock({
    lockName: `execution-card-${cardId}`,
    lockDir: join(storageDir, ".locks"),
    ownerId: randomUUID(),
    ttlMs: 30_000,
  });
  if (!lock.acquired) return { success: false, error: `Card '${cardId}' is locked by another update.` };

  try {
    const card = await getExecutionCard(cardId, storageDir);
    if (!card) {
      return { success: false, error: `Card with ID '${cardId}' not found.` };
    }

    const currentIndex = PHASE_ORDER.indexOf(card.currentPhase);
    const targetIndex = PHASE_ORDER.indexOf(targetPhase);

    if (targetIndex !== currentIndex + 1) {
      return {
        success: false,
        error: `Invalid phase transition from '${card.currentPhase}' to '${targetPhase}'. Expected next phase: '${PHASE_ORDER[currentIndex + 1]}'.`,
      };
    }

    const now = Date.now();
    card.currentPhase = targetPhase;
    card.updatedAt = now;
    card.history.push({ phase: targetPhase, timestamp: now, artifactPath, summary });

    const cardPath = getCardFilePath(storageDir, cardId);
    await replaceCardFile(cardPath, card);
    return { success: true, card };
  } finally {
    await releaseSwarmLock(lock);
  }
}
