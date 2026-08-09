import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const cli = join(root, "src", "cli.ts");
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function run(args: string[]) {
  return Bun.spawnSync(["bun", "run", cli, ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
}

test("export-trajectories requires and exports explicit recorded events", async () => {
  const dir = await mkdtemp(join(tmpdir(), "riqor-trajectory-"));
  tempRoots.push(dir);
  const input = join(dir, "events.json");
  await writeFile(input, JSON.stringify([
    { type: "user", content: "real user event" },
    { type: "assistant", content: "real assistant event" },
  ]));

  const result = run(["export-trajectories", input, "session-real"]);
  expect(result.exitCode).toBe(0);
  const parsed = JSON.parse(result.stdout.toString());
  expect(parsed.id).toBe("session-real");
  expect(parsed.conversations).toEqual([
    { from: "human", value: "real user event" },
    { from: "gpt", value: "real assistant event" },
  ]);
  expect(result.stdout.toString()).not.toContain("Run Riqor baseline checks");
});

test("export-trajectories rejects missing input instead of inventing sample events", () => {
  const result = run(["export-trajectories"]);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain("requires an events JSON file");
});

test("export-harness-config rejects unsupported targets", () => {
  const result = run(["export-harness-config", "not-an-agent"]);
  expect(result.exitCode).not.toBe(0);
  expect(result.stdout.toString()).toBe("");
  expect(result.stderr.toString()).toContain("unsupported harness target");
});


test("export-harness-config reports the repository package version", async () => {
  const result = run(["export-harness-config", "codex"]);
  expect(result.exitCode).toBe(0);
  const parsed = JSON.parse(result.stdout.toString());
  const pkg = await Bun.file(join(root, "package.json")).json();
  expect(parsed.harnessVersion).toBe(pkg.version);
});
