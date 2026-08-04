import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const cli = join(root, "src", "harness-cli.ts");
import { assessCodexDoctor } from "../src/harness-cli";

function run(args: string[], env: Record<string, string> = {}) {
  return Bun.spawnSync(["bun", "run", cli, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
}

test("prints a bounded version record", () => {
  const result = run(["version", "--json"]);
  expect(result.exitCode).toBe(0);
  const value = JSON.parse(result.stdout.toString());
  expect(value.name).toBe("codex-self-improvement-harness");
  expect(value.version).toMatch(/^0\./);
  expect(value.pluginVersion).toMatch(/^0\./);
});

test("lists all curated harness paths", () => {
  const result = run(["paths", "list", "--json"]);
  expect(result.exitCode).toBe(0);
  const value = JSON.parse(result.stdout.toString());
  expect(value.paths).toHaveLength(8);
  expect(value.paths.map((entry: any) => entry.id)).toContain("secure-change");
});

test("terminal commands keep command content out of output and state", async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), "csi-cli-"));
  const env = { CODEX_SELF_IMPROVEMENT_DATA: stateRoot };
  const command = "printf sk-super-secret > src/a.ts";
  expect(run(["terminal", "preexec", "--session", "cli-test", "--command", command], env).exitCode).toBe(0);
  const post = run(["terminal", "postexec", "--session", "cli-test", "--exit-code", "0"], env);
  expect(post.exitCode).toBe(0);
  expect(post.stdout.toString()).not.toContain(command);
  expect(post.stdout.toString()).not.toContain("sk-super-secret");
  const status = run(["terminal", "status", "--session", "cli-test", "--json"], env);
  expect(JSON.parse(status.stdout.toString()).evidencePending).toBe(true);
});

test("rejects unknown commands with a stable usage exit", () => {
  const result = run(["unknown-command"]);
  expect(result.exitCode).toBe(64);
  expect(result.stderr.toString()).toContain("usage:");
});


test("Codex doctor assessment separates core health from installation warnings", () => {
  const report = assessCodexDoctor(JSON.stringify({
    overallStatus: "fail",
    checks: {
      "auth.credentials": { status: "ok", summary: "configured" },
      "config.load": { status: "ok", summary: "loaded" },
      "network.provider_reachability": { status: "ok", summary: "reachable" },
      "state.paths": { status: "ok", summary: "readable" },
      installation: { status: "fail", summary: "duplicate npm install" },
      "updates.status": { status: "fail", summary: "new version" },
    },
  }));
  expect(report.coreOk).toBe(true);
  expect(report.externalIssues).toEqual([
    "installation: duplicate npm install",
    "updates.status: new version",
  ]);
});
