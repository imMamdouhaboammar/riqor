import { afterEach, describe, expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearTurn,
  consumeEvidenceGate,
  markRuntimeSeen,
  pruneState,
  recordMutation,
  recordVerification,
  turnKey,
} from "../plugins/codex-self-improvement/hooks/state";

const roots: string[] = [];
async function dataDir() {
  const root = await mkdtemp(join(tmpdir(), "codex-self-improvement-state-"));
  roots.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createHeldLock(root: string, key: string, pid = process.pid, createdAt = Date.now()) {
  const lock = join(root, `.${key}.lock`);
  await mkdir(lock, { mode: 0o700 });
  await writeFile(join(lock, "owner.json"), `${JSON.stringify({ version: 1, token: "test-owner", pid, createdAt })}\n`, { mode: 0o600 });
  return lock;
}

describe("bounded hook state", () => {
  test("records a content-free runtime marker", async () => {
    const root = await dataDir();
    await markRuntimeSeen(root, 123);
    const stored = await readFile(join(root, "runtime.json"), "utf8");
    expect(JSON.parse(stored)).toEqual({ version: 1, event: "SessionStart", lastSeenAt: 123 });
    expect(stored).not.toContain("session");
    expect((await stat(join(root, "runtime.json"))).size).toBeLessThan(128);
  });

  test("hashes identifiers and stores only bounded event metadata", async () => {
    const root = await dataDir();
    const key = turnKey({ session_id: "private-session", turn_id: "private-turn" });
    await recordMutation(root, key, "code", 100);
    const [name] = await readdir(root);
    const stored = await readFile(join(root, name), "utf8");
    expect(name).not.toContain("private-session");
    expect(name).not.toContain("private-turn");
    expect(stored).not.toContain("private-session");
    expect(stored).not.toContain("private-turn");
    expect(JSON.parse(stored)).toEqual({ version: 1, mutationKind: "code", mutatedAt: 100, blockedOnce: false });
    expect((await stat(root)).mode & 0o077).toBe(0);
    expect((await stat(join(root, name))).size).toBeLessThan(256);
  });

  test("a successful check clears pending evidence until a later mutation", async () => {
    const root = await dataDir();
    const key = turnKey({ session_id: "s", turn_id: "t" });
    await recordMutation(root, key, "code", 100);
    await recordVerification(root, key, 200);
    expect(await consumeEvidenceGate(root, key)).toEqual({ pending: false });
    await recordMutation(root, key, "config", 300);
    expect(await consumeEvidenceGate(root, key)).toEqual({ pending: true, firstBlock: true, mutationKind: "config" });
    expect(await consumeEvidenceGate(root, key)).toEqual({ pending: true, firstBlock: false, mutationKind: "config" });
  });

  test("waits for an active per-turn lock before updating state", async () => {
    const root = await dataDir();
    const key = turnKey({ session_id: "s", turn_id: "locked" });
    const lock = await createHeldLock(root, key);
    const release = setTimeout(() => void rm(lock, { recursive: true, force: true }), 35);
    const started = performance.now();
    await recordMutation(root, key, "code", 100);
    clearTimeout(release);
    expect(performance.now() - started).toBeGreaterThanOrEqual(20);
    expect((await readdir(root)).some((name) => name.endsWith(".lock"))).toBe(false);
  });

  test("does not delete a competing lock when acquisition times out", async () => {
    const root = await dataDir();
    const key = turnKey({ session_id: "s", turn_id: "competing" });
    const lock = await createHeldLock(root, key);
    await expect(recordMutation(root, key, "code", 100)).rejects.toThrow("timed out acquiring turn state lock");
    expect(JSON.parse(await readFile(join(lock, "owner.json"), "utf8")).pid).toBe(process.pid);
  });

  test("recovers an expired lock only after its owner has exited", async () => {
    const root = await dataDir();
    const key = turnKey({ session_id: "s", turn_id: "expired" });
    const lock = await createHeldLock(root, key, 2_147_483_647, 0);
    await recordMutation(root, key, "code", 100);
    expect(await readdir(root)).not.toContain(lock.split("/").at(-1));
    expect(JSON.parse(await readFile(join(root, `${key}.json`), "utf8")).mutatedAt).toBe(100);
  });

  test("recovers a hard-expired lock despite PID reuse", async () => {
    const root = await dataDir();
    const key = turnKey({ session_id: "s", turn_id: "hard-expired" });
    await createHeldLock(root, key, process.pid, 0);
    await recordMutation(root, key, "code", 101);
    expect(JSON.parse(await readFile(join(root, `${key}.json`), "utf8")).mutatedAt).toBe(101);
  });

  test("recovers an abandoned recovery marker", async () => {
    const root = await dataDir();
    const key = turnKey({ session_id: "s", turn_id: "recovery-marker" });
    const lock = await createHeldLock(root, key, 2_147_483_647, 0);
    await writeFile(join(lock, ".recovery.json"), `${JSON.stringify({ version: 1, token: "abandoned-recovery", pid: 2_147_483_647, createdAt: 0 })}\n`, { mode: 0o600 });
    await recordMutation(root, key, "code", 102);
    expect(JSON.parse(await readFile(join(root, `${key}.json`), "utf8")).mutatedAt).toBe(102);
  });

  test("replaces a hostile symlink without touching its target", async () => {
    const root = await dataDir();
    const key = turnKey({ session_id: "s", turn_id: "t" });
    const victim = join(root, "victim");
    await writeFile(victim, "untouched");
    await symlink(victim, join(root, `${key}.json`));
    await recordMutation(root, key, "unknown", 100);
    expect(await readFile(victim, "utf8")).toBe("untouched");
    expect((await lstat(join(root, `${key}.json`))).isSymbolicLink()).toBe(false);
  });

  test("prunes stale and excess state independently", async () => {
    const root = await dataDir();
    const staleKey = turnKey({ session_id: "s", turn_id: "0" });
    for (let index = 0; index < 6; index += 1) {
      await recordMutation(root, turnKey({ session_id: "s", turn_id: String(index) }), "code", index);
    }
    await utimes(join(root, `${staleKey}.json`), 0, 0);
    await pruneState(root, 10_000, { maxAgeMs: 9_995, maxFiles: 6 });
    expect(await readdir(root)).not.toContain(`${staleKey}.json`);
    await pruneState(root, Date.now(), { maxFiles: 3 });
    expect((await readdir(root)).filter((name) => name.endsWith(".json"))).toHaveLength(3);
  });

  test("skips stale and excess candidates while their turn lock is held", async () => {
    const root = await dataDir();
    const lockedKey = turnKey({ session_id: "s", turn_id: "locked-prune" });
    const otherKey = turnKey({ session_id: "s", turn_id: "other-prune" });
    await recordMutation(root, lockedKey, "code", 1);
    await recordMutation(root, otherKey, "code", 2);
    const lock = await createHeldLock(root, lockedKey);
    await pruneState(root, Date.now() + 1_000, { maxAgeMs: 1, maxFiles: 1 });
    expect(JSON.parse(await readFile(join(lock, "owner.json"), "utf8")).pid).toBe(process.pid);
    expect(await readdir(root)).toContain(`${lockedKey}.json`);
    expect(await readdir(root)).not.toContain(`${otherKey}.json`);
  });

  test("clears a turn idempotently", async () => {
    const root = await dataDir();
    const key = turnKey({ session_id: "s", turn_id: "t" });
    await recordMutation(root, key, "code", 100);
    await clearTurn(root, key);
    await clearTurn(root, key);
    expect(await readdir(root)).toEqual([]);
  });
});
