import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runSandboxedCheck } from "../src/checks";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

test("check runner rejects repositories inside OS temporary storage", async () => {
  const root = await mkdtemp(join(tmpdir(), "harness-sandbox-temp-"));
  temporaryPaths.push(root);
  const repo = join(root, "repo");
  await mkdir(repo);

  await expect(
    runSandboxedCheck(["bun", "-e", "process.exit(0)"], repo, resolve(import.meta.dir, "..")),
  ).rejects.toThrow("OS temporary storage");
});

test("check runner strips secrets and blocks reads and writes outside the synthetic repo", async () => {
  const workRoot = resolve(import.meta.dir, "..", "work");
  await mkdir(workRoot, { recursive: true });
  const root = await mkdtemp(join(workRoot, "harness-sandbox-test-"));
  temporaryPaths.push(root);
  const repo = join(root, "repo");
  await mkdir(repo);
  const outside = join(root, "outside.txt");
  await writeFile(join(repo, "probe.ts"), `
    let escaped = process.env.SYNTHETIC_SECRET !== undefined;
    try { await Bun.file(${JSON.stringify(join(homedir(), ".codex", "auth.json"))}).text(); escaped = true; } catch {}
    try { await Bun.write(${JSON.stringify(outside)}, "escape"); escaped = true; } catch {}
    try { await fetch("https://example.com", { signal: AbortSignal.timeout(1000) }); escaped = true; } catch {}
    process.exit(escaped ? 1 : 0);
  `);

  if (!Bun.which("codex")) return;
  const result = await runSandboxedCheck(
    ["bun", "probe.ts"],
    repo,
    resolve(import.meta.dir, ".."),
    { ...process.env, SYNTHETIC_SECRET: "must-not-reach-check" },
  );
  expect(result.exitCode).toBe(0);
  expect(await Bun.file(outside).exists()).toBe(false);
});

test("check runner times out an untrusted process tree", async () => {
  const workRoot = resolve(import.meta.dir, "..", "work");
  await mkdir(workRoot, { recursive: true });
  const root = await mkdtemp(join(workRoot, "harness-sandbox-timeout-"));
  temporaryPaths.push(root);
  const repo = join(root, "repo");
  await mkdir(repo);
  const started = performance.now();
  const result = await runSandboxedCheck(
    ["bun", "-e", "Bun.spawn(['bun', '-e', 'setInterval(()=>{},1000)'], { stdout: 'inherit' }); setInterval(()=>{},1000)"],
    repo,
    resolve(import.meta.dir, ".."),
    process.env,
    50,
  );
  expect(result.exitCode).toBe(124);
  expect(performance.now() - started).toBeLessThan(3_000);
});
