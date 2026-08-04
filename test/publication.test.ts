import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquirePublicationLock } from "../src/cli";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

async function stalePublication(committed: boolean) {
  const root = await mkdtemp(join(tmpdir(), "publication-recovery-"));
  roots.push(root);
  const lock = join(root, ".evidence.lock");
  const staleStamp = ".pending-stale";
  const finals = ["evidence.json", "evidence.toon", "EVIDENCE.md"].map((name) => join(root, name));
  await mkdir(lock);
  await writeFile(join(lock, "owner.json"), JSON.stringify({ pid: 999_999, stamp: staleStamp, existed: [true, true, true] }));
  if (committed) await writeFile(join(lock, "committed"), staleStamp);
  for (const path of finals) {
    await writeFile(path, "new");
    await writeFile(`${path}${staleStamp}.backup`, "old");
    await writeFile(`${path}${staleStamp}`, "pending");
  }
  await acquirePublicationLock(lock, finals, ".pending-current");
  return { lock, finals, staleStamp };
}

test("recovers the previous evidence generation after an interrupted commit", async () => {
  const { lock, finals, staleStamp } = await stalePublication(false);
  expect(await Promise.all(finals.map((path) => readFile(path, "utf8")))).toEqual(["old", "old", "old"]);
  expect(await Promise.all(finals.map((path) => Bun.file(`${path}${staleStamp}.backup`).exists()))).toEqual([false, false, false]);
  expect(await Bun.file(join(lock, "owner.json")).exists()).toBe(true);
});

test("keeps a fully committed generation while clearing stale publication state", async () => {
  const { lock, finals, staleStamp } = await stalePublication(true);
  expect(await Promise.all(finals.map((path) => readFile(path, "utf8")))).toEqual(["new", "new", "new"]);
  expect(await Promise.all(finals.map((path) => Bun.file(`${path}${staleStamp}.backup`).exists()))).toEqual([false, false, false]);
  expect(await Bun.file(join(lock, "owner.json")).exists()).toBe(true);
});
