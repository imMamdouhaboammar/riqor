import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { appendEvidenceLedger, readEvidenceLedger } from "../src/evidence-ledger";

const root = resolve(import.meta.dir, "..");
const cli = join(root, "src", "harness-cli.ts");

function run(args: string[], cwd = root) {
  return Bun.spawnSync(["bun", "run", cli, ...args], {
    cwd,
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
}

test("evidence ledger appends and reads closed-loop entries", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "riqor-evidence-"));
  try {
    const path = await appendEvidenceLedger(tempDir, {
      kind: "mutation",
      summary: "Updated CLI options in src/harness-cli.ts",
      status: "success",
    });
    expect(path).toContain(".riqor/EVIDENCE.md");

    const content = await readEvidenceLedger(tempDir);
    expect(content).toContain("Closed-Loop Evidence Ledger");
    expect(content).toContain("MUTATION");
    expect(content).toContain("Updated CLI options");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("evidence CLI command records and reads entries", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "riqor-cli-evidence-"));
  try {
    const addResult = run(["evidence", "add", "verification", "Ran bun test with 300 passing checks"], tempDir);
    expect(addResult.exitCode).toBe(0);

    const readResult = run(["evidence", "--json"], tempDir);
    expect(readResult.exitCode).toBe(0);
    const output = JSON.parse(readResult.stdout.toString());
    expect(output.content).toContain("Ran bun test with 300 passing checks");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("loop CLI command returns telemetry cost and audit metrics", () => {
  const costResult = run(["loop", "cost", "--json"]);
  expect(costResult.exitCode).toBe(0);
  const costData = JSON.parse(costResult.stdout.toString());
  expect(costData.ok).toBe(true);

  const auditResult = run(["loop", "audit", "--json"]);
  expect(auditResult.exitCode).toBe(0);
  const auditData = JSON.parse(auditResult.stdout.toString());
  expect(auditData.ok).toBeDefined();
});

test("verify --sdlc executes multi-role pipeline passes", () => {
  const result = run(["verify", "--sdlc", "--json"]);
  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout.toString());
  expect(report.gates).toHaveLength(3);
  expect(report.gates.map((g: any) => g.name)).toContain("Architecture Pass");
  expect(report.gates.map((g: any) => g.name)).toContain("Skeptical Verification Pass");
});
