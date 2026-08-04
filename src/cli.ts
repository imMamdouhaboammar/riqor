import { chmod, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalDigest, deriveScenarioResult, validateScenarioSet } from "./harness";
import { runSandboxedCheck } from "./checks";
import { createCapsule, destroyCapsule, selectedCapabilities } from "./capsule";
import { holdouts } from "./holdouts";
import {
  buildCodexCommand,
  countErrorLines,
  extractTelemetry,
  renderBaseline,
  renderFinalEvaluation,
  resolveCheckCommand,
  type BenchmarkRun,
  type PublicScenarioResult,
} from "./runner";
import { scenarios, type ExecutableScenario } from "./scenarios";
import { runProcess } from "./process";

const harnessRoot = resolve(import.meta.dir, "..");
const objectivePath = join(harnessRoot, "OBJECTIVE.md");

type RunMode = "control" | "candidate";

async function runChecks(scenario: ExecutableScenario, repo: string) {
  const checks = [];
  for (const { id, command } of scenario.checks) {
    const check = await runSandboxedCheck(resolveCheckCommand(command, harnessRoot), repo, harnessRoot);
    checks.push({ id, exitCode: check.exitCode });
  }
  return checks;
}

const sha256 = (contents: string) => createHash("sha256").update(contents).digest("hex");

function encodeToon(jsonPath: string, toonPath: string) {
  const encoding = Bun.spawnSync(["toon", "--encode", "--stats", "--output", toonPath, jsonPath], {
    cwd: harnessRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (encoding.exitCode !== 0) throw new Error("TOON encoding failed");
  process.stderr.write(encoding.stderr);
}

type PublicationOwner = { pid: number; stamp: string; existed?: boolean[] };

async function readPublicationOwner(lock: string) {
  try {
    return JSON.parse(await readFile(join(lock, "owner.json"), "utf8")) as PublicationOwner;
  } catch {
    return undefined;
  }
}

function processIsAlive(pid: number) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export async function acquirePublicationLock(lock: string, finalPaths: string[], stamp: string) {
  const recovery = `${lock}.recovery`;
  if (await Bun.file(recovery).exists()) {
    const owner = await readPublicationOwner(recovery);
    if (owner && processIsAlive(owner.pid)) throw new Error("evidence publication recovery is in progress");
    await rm(recovery, { recursive: true, force: true });
  }
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch (error) {
    const owner = await readPublicationOwner(lock);
    if (owner && processIsAlive(owner.pid)) throw new Error("evidence publication is already in progress", { cause: error });
    if (!owner && Date.now() - (await stat(lock)).mtimeMs < 5_000) throw new Error("evidence publication lock is initializing", { cause: error });
    await mkdir(recovery, { mode: 0o700 });
    await writeFile(join(recovery, "owner.json"), JSON.stringify({ pid: process.pid }), { mode: 0o600 });
    try {
      const stale = await readPublicationOwner(lock);
      if (stale?.existed && !(await Bun.file(join(lock, "committed")).exists())) {
        for (let index = 0; index < finalPaths.length; index += 1) {
          const backup = `${finalPaths[index]}${stale.stamp}.backup`;
          if (stale.existed[index] && await Bun.file(backup).exists()) await rename(backup, finalPaths[index]!);
          else if (!stale.existed[index]) await rm(finalPaths[index]!, { force: true });
        }
      }
      if (stale?.stamp) {
        await Promise.all(finalPaths.flatMap((path) => [
          rm(`${path}${stale.stamp}`, { force: true }),
          rm(`${path}${stale.stamp}.backup`, { force: true }),
        ]));
      }
      await rm(lock, { recursive: true, force: true });
      await mkdir(lock, { mode: 0o700 });
    } finally {
      await rm(recovery, { recursive: true, force: true });
    }
  }
  const existed = await Promise.all(finalPaths.map((path) => Bun.file(path).exists()));
  await writeFile(join(lock, "owner.json"), JSON.stringify({ pid: process.pid, stamp, existed }), { mode: 0o600 });
  return existed;
}

async function publishEvidence(baseName: "baseline-results" | "final-results", json: string, markdown: string) {
  const stamp = `.pending-${process.pid}-${Date.now()}`;
  const finalJson = join(harnessRoot, `${baseName}.json`);
  const finalToon = join(harnessRoot, `${baseName}.toon`);
  const finalMarkdown = join(harnessRoot, baseName === "baseline-results" ? "BASELINE.md" : "FINAL_EVALUATION.md");
  const publicationLock = join(harnessRoot, `.${baseName}.lock`);
  const temporaryJson = `${finalJson}${stamp}`;
  const temporaryToon = `${finalToon}${stamp}`;
  const temporaryMarkdown = `${finalMarkdown}${stamp}`;
  const finalPaths = [finalJson, finalToon, finalMarkdown];
  const temporaryPaths = [temporaryJson, temporaryToon, temporaryMarkdown];
  const backupPaths = finalPaths.map((path) => `${path}${stamp}.backup`);
  const existed = await acquirePublicationLock(publicationLock, finalPaths, stamp);
  let preserveBackups = false;
  try {
    await writeFile(temporaryJson, json, { encoding: "utf8", mode: 0o600 });
    encodeToon(temporaryJson, temporaryToon);
    await writeFile(temporaryMarkdown, markdown, { encoding: "utf8", mode: 0o600 });
    await Promise.all(finalPaths.map((path, index) => existed[index] ? cp(path, backupPaths[index]!) : undefined));
    try {
      for (let index = 0; index < finalPaths.length; index += 1) {
        await rename(temporaryPaths[index]!, finalPaths[index]!);
      }
      await writeFile(join(publicationLock, "committed"), stamp, { mode: 0o600 });
    } catch (error) {
      const restored = await Promise.allSettled(finalPaths.map(async (path, index) => {
        if (existed[index]) await rename(backupPaths[index]!, path);
        else await rm(path, { force: true });
      }));
      const restoreFailure = restored.find((result): result is PromiseRejectedResult => result.status === "rejected");
      if (restoreFailure) {
        preserveBackups = true;
        throw new AggregateError([error, restoreFailure.reason], "Evidence publication and rollback failed; backups preserved");
      }
      throw error;
    }
  } finally {
    const cleanup = preserveBackups ? temporaryPaths : [...temporaryPaths, ...backupPaths];
    if (!preserveBackups) cleanup.push(publicationLock);
    await Promise.all(cleanup.map((path) => rm(path, { recursive: true, force: true })));
  }
}

type ScenarioRun = {
  scenario: ExecutableScenario;
  runRoot: string;
  fixtureRoot: string;
  mode: RunMode;
};

async function agentRun(input: ScenarioRun, repo: string, finalPath: string) {
  if (input.mode === "control") {
    return runProcess(buildCodexCommand(repo, finalPath, input.scenario.prompt), repo, process.env);
  }
  const capabilities = selectedCapabilities(input.scenario.prompt);
  const capsule = await createCapsule({ authPath: join(homedir(), ".codex", "auth.json"), capabilities });
  try {
    const environment = { ...process.env, CODEX_HOME: capsule };
    return runProcess(buildCodexCommand(repo, finalPath, input.scenario.prompt), repo, environment);
  } finally {
    await destroyCapsule(capsule);
  }
}

async function runScenario(input: ScenarioRun): Promise<PublicScenarioResult> {
  const { scenario, runRoot, fixtureRoot, mode } = input;
  const repo = join(runRoot, scenario.id);
  const finalPath = join(repo, ".harness-final.txt");
  await cp(join(fixtureRoot, scenario.id), repo, { recursive: true });
  process.stderr.write(`START ${mode} ${scenario.id}\n`);
  const started = performance.now();
  const agent = await agentRun(input, repo, finalPath);
  const durationMs = Math.round(performance.now() - started);
  const telemetry = extractTelemetry(agent.stdout);
  const checks = await runChecks(scenario, repo);
  const finalOutput = await Bun.file(finalPath).exists() ? await readFile(finalPath, "utf8") : null;
  const derived = deriveScenarioResult({
    scenarioId: scenario.id,
    durationMs,
    agentExitCode: agent.exitCode,
    checks,
    expectedTools: scenario.expectedTools,
    observedTools: telemetry.observedTools,
    tokens: telemetry.usageAvailable ? telemetry.inputTokens + telemetry.outputTokens : undefined,
  });
  await rm(finalPath, { force: true });
  process.stderr.write(`DONE ${mode} ${scenario.id} ${derived.passed ? "PASS" : "FAIL"}\n`);
  return {
    ...derived,
    tokens: derived.tokens ?? null,
    interventionRequired: agent.exitCode !== 0,
    eventErrors: telemetry.eventErrors + countErrorLines(agent.stderr),
    checkEvidence: checks,
    agentExitCode: agent.exitCode,
    finalOutputDigest: finalOutput === null ? null : sha256(finalOutput),
  };
}

async function runWithTwoWorkers(
  scenarioSet: ExecutableScenario[],
  fixtureRoot: string,
  runRoot: string,
  mode: RunMode,
) {
  const pending = [...scenarioSet];
  const completed: PublicScenarioResult[] = [];
  async function worker() {
    while (pending.length > 0) {
      const scenario = pending.shift();
      if (scenario) completed.push(await runScenario({ scenario, fixtureRoot, runRoot, mode }));
    }
  }
  const outcomes = await Promise.allSettled([worker(), worker()]);
  const failure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
  if (failure) throw failure.reason;
  return scenarioSet.map(({ id }) => completed.find(({ scenarioId }) => scenarioId === id)!);
}

function commandOutput(command: string[]) {
  const execution = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe" });
  if (execution.exitCode !== 0) throw new Error(`${command[0]} inventory command failed`);
  return execution.stdout.toString().trim();
}

async function environmentSnapshot() {
  const config = await readFile(join(homedir(), ".codex", "config.toml"), "utf8");
  const plugins = JSON.parse(commandOutput(["codex", "plugin", "list", "--json"]));
  return {
    configDigest: canonicalDigest(config),
    pluginDigest: canonicalDigest(plugins),
    codexVersion: commandOutput(["codex", "--version"]),
  };
}

async function baseline() {
  const startedAt = new Date().toISOString();
  const runId = `baseline-${startedAt.replace(/[:.]/g, "-")}`;
  const runRoot = join(harnessRoot, ".runs", runId);
  await mkdir(runRoot, { recursive: true, mode: 0o700 });
  await chmod(runRoot, 0o700);
  try {
    const objectiveDigest = sha256((await readFile(objectivePath, "utf8")).replace(/\n$/, ""));
    const environment = await environmentSnapshot();
    const results = await runWithTwoWorkers(validateScenarioSet(scenarios), join(harnessRoot, "fixtures"), runRoot, "control");
    const run: BenchmarkRun = {
      runId,
      startedAt,
      objectiveDigest,
      model: "gpt-5.6-sol",
      ...environment,
      results,
    };
    await publishEvidence("baseline-results", `${JSON.stringify(run, null, 2)}\n`, renderBaseline(run));
    process.stdout.write(`${runId}\n`);
  } finally {
    await rm(runRoot, { recursive: true, force: true });
  }
}

async function capsuleNames() {
  return (await readdir(tmpdir())).filter((name) => name.startsWith("codex-capability-capsule-")).sort();
}

async function compare() {
  const startedAt = new Date().toISOString();
  const runId = `compare-${startedAt.replace(/[:.]/g, "-")}`;
  const runRoot = join(harnessRoot, ".runs", runId);
  await mkdir(runRoot, { recursive: true, mode: 0o700 });
  await chmod(runRoot, 0o700);
  try {
    const objectiveDigest = sha256((await readFile(objectivePath, "utf8")).replace(/\n$/, ""));
    const controlBefore = await environmentSnapshot();
    const fixtureRoot = join(harnessRoot, "holdouts", "fixtures");
    const control = await runWithTwoWorkers(holdouts, fixtureRoot, join(runRoot, "control"), "control");
    const candidateBefore = await environmentSnapshot();
    const capsulesBefore = await capsuleNames();
    const candidate = await runWithTwoWorkers(holdouts, fixtureRoot, join(runRoot, "candidate"), "candidate");
    const candidateAfter = await environmentSnapshot();
    const rollbackVerified =
      candidateBefore.configDigest === candidateAfter.configDigest &&
      candidateBefore.pluginDigest === candidateAfter.pluginDigest &&
      JSON.stringify(capsulesBefore) === JSON.stringify(await capsuleNames());
    const wholeRunStateUnchanged =
      controlBefore.configDigest === candidateAfter.configDigest &&
      controlBefore.pluginDigest === candidateAfter.pluginDigest;
    const evaluation = { runId, startedAt, control, candidate, rollbackVerified, wholeRunStateUnchanged };
    const evidence = {
      ...evaluation,
      objectiveDigest,
      capsuleVersion: "0.3.0",
      controlBefore,
      candidateBefore,
      candidateAfter,
    };
    await publishEvidence("final-results", `${JSON.stringify(evidence, null, 2)}\n`, renderFinalEvaluation(evaluation));
    process.stdout.write(`${runId}\n`);
  } finally {
    await rm(runRoot, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  if (process.argv[2] === "baseline") await baseline();
  else if (process.argv[2] === "compare") await compare();
  else throw new Error("usage: bun run src/cli.ts <baseline|compare>");
}
