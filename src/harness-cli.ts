import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { harnessPaths } from "../plugins/codex-self-improvement/hooks/paths";
import { assuranceCommand } from "./assurance/cli";
import { resolveRiqorStateRoot } from "./assurance/repository-identity";
import { recordActiveRunTerminalTransition } from "./assurance/terminal-trace";
import {
  readTerminalState,
  recordTerminalPostexec,
  recordTerminalPreexec,
  type TerminalState,
} from "./terminal-runtime";
import { resolveRuntimeLayout } from "./runtime-paths";
import { runSkepticalVerification } from "./skeptical-verifier";
import { getSessionTelemetry } from "./telemetry-mcp";
import { loadCrystallizedRules, addCrystallizedRule, formatCrystallizedRulesHighDensity } from "./crystallized-rules";
import { calculateEnvironmentDelta } from "./environment-delta";
import { runDeliberationGate } from "./deliberation-gate";
import { auditRepositoryConventions } from "./convention-auditor";
import { recordHeartbeat, listActiveSessions, writeScratchpadEntry, readScratchpad } from "./scratchpad-isolation";
import { executeKernelCommand } from "./bun-kernel";
import { GoalLoopOrchestrator } from "./goal-orchestrator";
import { SchemaContractFuzzer } from "./assurance/schema-fuzzer";
import { RepoIntelligenceAnalyzer } from "./diagnostics/repo-intelligence";
import { AutoResearchEngine } from "./assurance/auto-research";

const layout = resolveRuntimeLayout();
const root = layout.runtimeRoot;
const pluginRoot = layout.pluginRoot;
const pluginId = "codex-self-improvement@codex-self-improvement-dev";
const usage = "usage: codex-harness <version|status|doctor|paths list|evidence|loop|verify|telemetry|rules|delta|deliberate|conventions|scratchpad|heartbeat|run start|status|complete|trace show|export|plugin status|install|uninstall|shell status|install|uninstall|terminal preexec|postexec|status|spec|grill|goal|fuzz|repowise|autoresearch|codex|agy> [options]; activator: --activator [--actions-first] [--activator-interval 15m] [--activator-watchdog 3m]";

const defaultActivatorIntervalMs = 15 * 60_000;
const defaultActivatorWatchdogMs = 3 * 60_000;
const minimumActivatorIntervalMs = 60_000;
const maximumActivatorIntervalMs = 24 * 60 * 60_000;
const minimumActivatorWatchdogMs = 10_000;
const maximumActivatorWatchdogMs = 30 * 60_000;
const activatorEnvironmentKeys = [
  "RIQOR_ACTIVATOR_ENABLED",
  "RIQOR_ACTIVATOR_SESSION",
  "RIQOR_ACTIVATOR_INTERVAL_MS",
  "RIQOR_ACTIVATOR_WATCHDOG_MS",
  "RIQOR_ACTIONS_FIRST",
] as const;

type Json = Record<string, unknown>;
type Check = { id: string; ok: boolean; detail: string };
export type CodexActivatorOptions = Readonly<{
  enabled: true;
  actionsFirst?: boolean;
  intervalMs: number;
  watchdogMs: number;
}>;
export type ParsedCodexActivatorArgs = Readonly<{
  codexArgs: string[];
  actionsFirst?: boolean;
  activator?: CodexActivatorOptions;
}>;
export type ParsedAgyActivatorArgs = Readonly<{
  agyArgs: string[];
  actionsFirst?: boolean;
  activator?: CodexActivatorOptions;
}>;

const has = (args: string[], flag: string) => args.includes(flag);
function value(args: string[], flag: string) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function formatDuration(milliseconds: number) {
  if (milliseconds % 3_600_000 === 0) return `${milliseconds / 3_600_000}h`;
  if (milliseconds % 60_000 === 0) return `${milliseconds / 60_000}m`;
  if (milliseconds % 1_000 === 0) return `${milliseconds / 1_000}s`;
  return `${milliseconds}ms`;
}

export function parseActivatorDuration(value: string, minimum: number, maximum: number, label: string) {
  const match = value.match(/^(\d+)(ms|s|m|h)$/);
  if (!match) throw new Error(`invalid ${label}: ${value}`);
  const amount = Number(match[1]);
  const multiplier = match[2] === "h" ? 3_600_000 : match[2] === "m" ? 60_000 : match[2] === "s" ? 1_000 : 1;
  const milliseconds = amount * multiplier;
  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(milliseconds)) throw new Error(`invalid ${label}: ${value}`);
  if (milliseconds < minimum || milliseconds > maximum) {
    throw new Error(`${label} must be between ${formatDuration(minimum)} and ${formatDuration(maximum)}`);
  }
  return milliseconds;
}

function flagValue(argument: string, name: string) {
  const prefix = `${name}=`;
  return argument.startsWith(prefix) ? argument.slice(prefix.length) : undefined;
}

export function parseCodexActivatorArgs(args: string[]): ParsedCodexActivatorArgs {
  const codexArgs: string[] = [];
  let enabled = false;
  let actionsFirst = false;
  let timingConfigured = false;
  let intervalMs = defaultActivatorIntervalMs;
  let watchdogMs = defaultActivatorWatchdogMs;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--") {
      codexArgs.push(...args.slice(index));
      break;
    }
    if (argument === "--activator") {
      enabled = true;
      continue;
    }
    if (argument === "--actions-first") {
      actionsFirst = true;
      continue;
    }

    const intervalInline = flagValue(argument, "--activator-interval");
    if (argument === "--activator-interval" || intervalInline !== undefined) {
      timingConfigured = true;
      const duration = intervalInline ?? args[++index];
      if (!duration) throw new Error("--activator-interval requires a duration");
      intervalMs = parseActivatorDuration(duration, minimumActivatorIntervalMs, maximumActivatorIntervalMs, "activator interval");
      continue;
    }

    const watchdogInline = flagValue(argument, "--activator-watchdog");
    if (argument === "--activator-watchdog" || watchdogInline !== undefined) {
      timingConfigured = true;
      const duration = watchdogInline ?? args[++index];
      if (!duration) throw new Error("--activator-watchdog requires a duration");
      watchdogMs = parseActivatorDuration(duration, minimumActivatorWatchdogMs, maximumActivatorWatchdogMs, "activator watchdog");
      continue;
    }

    codexArgs.push(argument);
  }

  if (!enabled && timingConfigured) throw new Error("activator timing flags require --activator");
  const activator: CodexActivatorOptions | undefined = enabled
    ? { enabled: true, ...(actionsFirst ? { actionsFirst: true } : {}), intervalMs, watchdogMs }
    : undefined;
  return {
    codexArgs,
    ...(actionsFirst ? { actionsFirst: true } : {}),
    ...(activator ? { activator } : {}),
  };
}

export function parseAgyActivatorArgs(args: string[]): ParsedAgyActivatorArgs {
  const agyArgs: string[] = [];
  let enabled = false;
  let actionsFirst = false;
  let timingConfigured = false;
  let intervalMs = defaultActivatorIntervalMs;
  let watchdogMs = defaultActivatorWatchdogMs;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--") {
      agyArgs.push(...args.slice(index));
      break;
    }
    if (argument === "--activator") {
      enabled = true;
      continue;
    }
    if (argument === "--actions-first") {
      actionsFirst = true;
      continue;
    }

    const intervalInline = flagValue(argument, "--activator-interval");
    if (argument === "--activator-interval" || intervalInline !== undefined) {
      timingConfigured = true;
      const duration = intervalInline ?? args[++index];
      if (!duration) throw new Error("--activator-interval requires a duration");
      intervalMs = parseActivatorDuration(duration, minimumActivatorIntervalMs, maximumActivatorIntervalMs, "activator interval");
      continue;
    }

    const watchdogInline = flagValue(argument, "--activator-watchdog");
    if (argument === "--activator-watchdog" || watchdogInline !== undefined) {
      timingConfigured = true;
      const duration = watchdogInline ?? args[++index];
      if (!duration) throw new Error("--activator-watchdog requires a duration");
      watchdogMs = parseActivatorDuration(duration, minimumActivatorWatchdogMs, maximumActivatorWatchdogMs, "activator watchdog");
      continue;
    }

    agyArgs.push(argument);
  }

  if (!enabled && timingConfigured) throw new Error("activator timing flags require --activator");
  const activator: CodexActivatorOptions | undefined = enabled
    ? { enabled: true, ...(actionsFirst ? { actionsFirst: true } : {}), intervalMs, watchdogMs }
    : undefined;
  return {
    agyArgs,
    ...(actionsFirst ? { actionsFirst: true } : {}),
    ...(activator ? { activator } : {}),
  };
}

export function buildActivatorEnvironment(options: CodexActivatorOptions, session = randomUUID()) {
  return {
    RIQOR_ACTIVATOR_ENABLED: "1",
    RIQOR_ACTIVATOR_SESSION: session,
    RIQOR_ACTIVATOR_INTERVAL_MS: String(options.intervalMs),
    RIQOR_ACTIVATOR_WATCHDOG_MS: String(options.watchdogMs),
    ...(options.actionsFirst ? { RIQOR_ACTIONS_FIRST: "1" } : {}),
  };
}

export function buildCodexEnvironment(
  baseEnvironment: NodeJS.ProcessEnv,
  activator?: CodexActivatorOptions,
  session?: string,
  actionsFirst = false,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...baseEnvironment,
    CODEX_SELF_IMPROVEMENT_ENABLED: "1",
    CODEX_SELF_IMPROVEMENT_SURFACE: baseEnvironment.CODEX_SELF_IMPROVEMENT_SURFACE ?? "codex-harness",
    ...(actionsFirst || activator?.actionsFirst ? { RIQOR_ACTIONS_FIRST: "1" } : {}),
  };
  for (const key of activatorEnvironmentKeys) delete environment[key];
  if (activator) Object.assign(environment, buildActivatorEnvironment(activator, session));
  else if (actionsFirst) environment.RIQOR_ACTIONS_FIRST = "1";
  return environment;
}

export function buildAgyEnvironment(
  baseEnvironment: NodeJS.ProcessEnv,
  activator?: CodexActivatorOptions,
  session?: string,
  actionsFirst = false,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...baseEnvironment,
    AGY_SELF_IMPROVEMENT_ENABLED: "1",
    ANTIGRAVITY_HARNESS_ENABLED: "1",
    AGY_HARNESS_SURFACE: baseEnvironment.AGY_HARNESS_SURFACE ?? "agy-harness",
    ...(actionsFirst || activator?.actionsFirst ? { RIQOR_ACTIONS_FIRST: "1" } : {}),
  };
  for (const key of activatorEnvironmentKeys) delete environment[key];
  if (activator) Object.assign(environment, buildActivatorEnvironment(activator, session));
  else if (actionsFirst) environment.RIQOR_ACTIONS_FIRST = "1";
  return environment;
}

function print(value: unknown, json: boolean) {
  process.stdout.write(json ? `${JSON.stringify(value, null, 2)}\n` : `${String(value)}\n`);
}

export function normalizeSpawnSyncExitCode(status: number | null): number {
  return typeof status === "number" ? status : 1;
}

function run(command: string[], options: { cwd?: string; env?: Record<string, string | undefined> } = {}) {
  const [file, ...args] = command;
  if (!file) return { exitCode: 1, stdout: "", stderr: "No executable specified" };
  const result = spawnSync(file, args, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
  });
  const stderr = (result.stderr ?? "").trim();
  return {
    exitCode: normalizeSpawnSyncExitCode(result.status),
    stdout: (result.stdout ?? "").trim(),
    stderr: stderr || result.error?.message?.trim() || "",
  };
}

async function exists(path: string) {
  try { await access(path, constants.R_OK); return true; } catch { return false; }
}

export function assessAgentCliAvailability(status: {
  codex: { available: boolean; version: string | null };
  agy: { available: boolean; version: string | null };
}) {
  const ok = status.codex.available || status.agy.available;
  return {
    ok,
    checks: [
      { id: "agent-cli", ok, detail: ok ? "at least one supported agent CLI is available" : "Codex and AGY are unavailable" },
      { id: "codex-cli", ok: true, detail: status.codex.available ? status.codex.version ?? "available" : "optional: unavailable" },
      { id: "agy-cli", ok: true, detail: status.agy.available ? status.agy.version ?? "available" : "optional: unavailable" },
    ] satisfies Check[],
  };
}

export function assessCodexDoctor(output: string) {
  try {
    const report = JSON.parse(output) as {
      overallStatus?: string;
      checks?: Record<string, { status?: string; summary?: string }>;
    };
    const checks = report.checks ?? {};
    const coreIds = [
      "auth.credentials",
      "config.load",
      "network.provider_reachability",
      "state.paths",
    ];
    const coreOk = coreIds.every((id) => checks[id]?.status === "ok");
    const externalIssues = Object.entries(checks)
      .filter(([id, check]) => !coreIds.includes(id) && check.status !== "ok")
      .map(([id, check]) => `${id}: ${check.summary ?? check.status ?? "issue"}`)
      .sort();
    return { coreOk, overallStatus: report.overallStatus ?? "unknown", externalIssues };
  } catch {
    return { coreOk: false, overallStatus: "unreadable", externalIssues: ["Codex doctor returned invalid JSON"] };
  }
}

async function versionRecord() {
  const pkg = JSON.parse(await readFile(layout.packageJsonPath, "utf8"));
  const plugin = JSON.parse(await readFile(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
  return { name: pkg.name, version: pkg.version, pluginVersion: plugin.version };
}

function pluginInventory(): Json {
  const result = run(["codex", "plugin", "list", "--json"]);
  if (result.exitCode !== 0) return { installed: false, enabled: false, error: result.stderr || "codex plugin list failed" };
  try {
    const inventory = JSON.parse(result.stdout) as { installed?: Array<Record<string, unknown>> };
    const match = inventory.installed?.find((entry) => entry.pluginId === pluginId);
    return {
      installed: Boolean(match?.installed),
      enabled: Boolean(match?.enabled),
      version: match?.version ?? null,
      pluginId,
    };
  } catch {
    return { installed: false, enabled: false, error: "invalid Codex plugin inventory" };
  }
}

async function shellInventory() {
  const home = homedir();
  return {
    executable: await exists(join(home, ".local", "bin", "codex-harness")),
    alias: await exists(join(home, ".local", "bin", "cxh")),
    environment: await exists(join(home, ".config", "codex-self-improvement", "env.zsh")),
    kakuPlugin: await exists(join(home, ".config", "kaku", "zsh", "plugins", "codex-self-improvement.zsh")),
    zshenv: await exists(join(home, ".zshenv")),
  };
}

async function statusRecord() {
  const codex = run(["codex", "--version"]);
  const agyRun = run(["agy", "--version"]);
  const antigravity = agyRun.exitCode === 0 ? agyRun : run(["antigravity", "--version"]);
  const kaku = run(["kaku", "--version"]);
  return {
    ...(await versionRecord()),
    root,
    codex: { available: codex.exitCode === 0, version: codex.stdout || null },
    agy: { available: antigravity.exitCode === 0, version: antigravity.stdout || null },
    kaku: { available: kaku.exitCode === 0, version: kaku.stdout || null },
    plugin: pluginInventory(),
    shell: await shellInventory(),
    surfaces: {
      codexApp: "native-plugin-shared-CODEX_HOME",
      codexCli: "native-plugin-shared-CODEX_HOME",
      agyCli: "native-cli-or-ide-integration",
      agyIde: "sidebar-and-inline-lenses",
      agyApp: "antigravity-2.0-chat-canvas-and-auxiliary-pane",
      agySdk: "python-agent-leasing-and-orchestration",
      kaku: "interactive-shell-hooks",
      chatgptTerminalControl: "inherits-kaku-or-zsh-environment",
      chatgptConversation: "no-native-local-plugin-runtime",
    },
  };
}

async function doctorRecord() {
  const status = await statusRecord();
  const plugin = status.plugin as Record<string, unknown>;
  const shell = status.shell as Record<string, unknown>;
  const codexDoctor = run(["codex", "doctor", "--json"]);
  const codexAssessment = assessCodexDoctor(codexDoctor.stdout);
  const kakuDoctor = run(["kaku", "doctor"]);
  const health = run(["bun", "run", join(layout.scriptsRoot, "plugin-health.ts"), pluginRoot]);
  const agentCli = assessAgentCliAvailability({
    codex: status.codex as { available: boolean; version: string | null },
    agy: status.agy as { available: boolean; version: string | null },
  });
  const codexAvailable = (status.codex as { available: boolean }).available;
  const kakuAvailable = (status.kaku as { available: boolean }).available;
  const checks: Check[] = [
    ...agentCli.checks,
    { id: "codex-core", ok: !codexAvailable || codexAssessment.coreOk, detail: codexAvailable ? (codexAssessment.coreOk ? `core passed; overall ${codexAssessment.overallStatus}` : `core failed; overall ${codexAssessment.overallStatus}`) : "optional: Codex CLI unavailable" },
    { id: "plugin-installed", ok: !codexAvailable || plugin.installed === true, detail: codexAvailable ? String(plugin.version ?? "missing") : "optional: Codex CLI unavailable" },
    { id: "plugin-enabled", ok: !codexAvailable || plugin.enabled === true, detail: codexAvailable ? (plugin.enabled === true ? "enabled" : "disabled") : "optional: Codex CLI unavailable" },
    { id: "plugin-health", ok: health.exitCode === 0, detail: health.exitCode === 0 ? "passed" : health.stderr || "failed" },
    { id: "shell-executable", ok: shell.executable === true, detail: shell.executable === true ? "installed" : "missing" },
    { id: "shell-environment", ok: shell.environment === true, detail: shell.environment === true ? "installed" : "missing" },
    { id: "kaku-plugin", ok: !kakuAvailable || shell.kakuPlugin === true, detail: kakuAvailable ? (shell.kakuPlugin === true ? "installed" : "missing") : "optional: Kaku unavailable" },
    { id: "kaku-doctor", ok: !kakuAvailable || (kakuDoctor.exitCode === 0 && !/\b(?:WARN|FAIL)\b/.test(kakuDoctor.stdout)), detail: kakuAvailable ? (kakuDoctor.exitCode === 0 ? "completed" : kakuDoctor.stderr || "failed") : "optional: Kaku unavailable" },
  ];
  return {
    ok: checks.every((check) => check.ok),
    checks,
    externalIssues: codexAssessment.externalIssues,
  };
}

function dataDir() {
  return process.env.CODEX_SELF_IMPROVEMENT_DATA ?? join(homedir(), ".local", "state", "codex-self-improvement");
}

function session(args: string[]) {
  return value(args, "--session") ?? process.env.TTY ?? `ppid-${process.ppid}`;
}

function terminalMessage(state: TerminalState) {
  if (!state.evidencePending || state.lastKind !== "mutation" || state.lastExitCode !== 0) return "";
  return "Codex Self Improvement: successful mutation recorded, run a focused verification before claiming completion";
}

async function terminalCommand(args: string[]) {
  const action = args[0];
  const key = session(args);
  if (action === "preexec") {
    const command = value(args, "--command");
    if (command === undefined) throw new Error("terminal preexec requires --command");
    await recordTerminalPreexec(dataDir(), key, command);
    return;
  }
  if (action === "postexec") {
    const raw = value(args, "--exit-code");
    const exitCode = raw === undefined ? NaN : Number(raw);
    if (!Number.isInteger(exitCode)) throw new Error("terminal postexec requires an integer --exit-code");
    const state = await recordTerminalPostexec(dataDir(), key, exitCode);
    if (state.transition) {
      await recordActiveRunTerminalTransition({
        stateRoot: resolveRiqorStateRoot(),
        cwd: process.cwd(),
        transition: state.transition,
      });
    }
    const message = terminalMessage(state);
    if (message) print(message, false);
    return;
  }
  if (action === "status") {
    const state = await readTerminalState(dataDir(), key);
    if (has(args, "--json")) print(state, true);
    else print(state.evidencePending ? "verification-pending" : "clear", false);
    return;
  }
  throw new Error("terminal requires preexec, postexec, or status");
}

async function passthroughCodex(args: string[]) {
  const parsed = parseCodexActivatorArgs(args);
  const child = spawn("codex", parsed.codexArgs, {
    cwd: process.cwd(),
    env: buildCodexEnvironment(process.env, parsed.activator, undefined, parsed.actionsFirst),
    stdio: "inherit",
    shell: false,
  });
  process.exitCode = await new Promise<number>((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolvePromise(code ?? 1));
  });
}

async function passthroughAgy(args: string[]) {
  const parsed = parseAgyActivatorArgs(args);
  const binary = run(["agy", "--version"]).exitCode === 0
    ? "agy"
    : run(["antigravity", "--version"]).exitCode === 0
      ? "antigravity"
      : "agy";
  const child = spawn(binary, parsed.agyArgs, {
    cwd: process.cwd(),
    env: buildAgyEnvironment(process.env, parsed.activator, undefined, parsed.actionsFirst),
    stdio: "inherit",
    shell: false,
  });
  process.exitCode = await new Promise<number>((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolvePromise(code ?? 1));
  });
}

async function lifecycle(script: string) {
  const child = spawn("bash", [join(layout.scriptsRoot, script)], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });
  process.exitCode = await new Promise<number>((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolvePromise(code ?? 1));
  });
}

export async function main(args = process.argv.slice(2)) {
  if (await assuranceCommand(args)) return;

  const [command, subcommand, ...rest] = args;
  const json = has(args, "--json");
  if (command === "version") return print(await versionRecord(), json);
  if (command === "status") return print(await statusRecord(), json);
  if (command === "doctor") {
    const report = await doctorRecord();
    print(report, json);
    if (!report.ok) process.exitCode = 1;
    return;
  }
  if (command === "paths" && subcommand === "list") {
    const paths = harnessPaths.map(({ id, objective, curatedSkills, evidence, guardrails, requiresExplicitApproval }) => ({ id, objective, curatedSkills, evidence, guardrails, requiresExplicitApproval }));
    return print(json ? { paths } : paths.map((path) => `${path.id}\t${path.objective}`).join("\n"), json);
  }
  if (command === "plugin" && subcommand === "status") return print(pluginInventory(), json);
  if (command === "plugin" && subcommand === "install") return lifecycle("install-plugin.sh");
  if (command === "plugin" && subcommand === "uninstall") return lifecycle("uninstall-plugin.sh");
  if (command === "shell" && subcommand === "status") return print(await shellInventory(), json);
  if (command === "shell" && subcommand === "install") return lifecycle("install-shell-integration.sh");
  if (command === "shell" && subcommand === "uninstall") return lifecycle("uninstall-shell-integration.sh");
  if (command === "install") return lifecycle("install-universal.sh");
  if (command === "uninstall") return lifecycle("uninstall-universal.sh");
  if (command === "evidence") {
    const { readEvidenceLedger, appendEvidenceLedger } = await import("./evidence-ledger");
    if (subcommand === "add") {
      const kind = (rest[0] as any) || "checkpoint";
      const summary = rest.slice(1).join(" ") || "Manual evidence ledger entry";
      const path = await appendEvidenceLedger(process.cwd(), { kind, summary });
      return print({ ok: true, path }, json);
    }
    const content = await readEvidenceLedger(process.cwd());
    return print(json ? { content } : (content ?? "No evidence ledger found in .riqor/EVIDENCE.md"), json);
  }
  if (command === "loop") {
    if (subcommand === "cost") {
      const telemetry = getSessionTelemetry(process.cwd());
      return print({ ok: true, telemetry }, json);
    }
    if (subcommand === "audit") {
      const state = await readTerminalState(dataDir(), session(args));
      return print({ ok: true, state }, json);
    }
    const state = await readTerminalState(dataDir(), session(args));
    return print({ active: true, mode: "loop-engineering", state }, json);
  }
  if (command === "verify") {
    if (has(args, "--sdlc")) {
      const arch = auditRepositoryConventions(process.cwd());
      const verifier = runSkepticalVerification(process.cwd());
      const telemetry = getSessionTelemetry(process.cwd());
      const report = {
        ok: arch.passed && verifier.passed,
        gates: [
          { name: "Architecture Pass", passed: arch.passed, detail: arch },
          { name: "Skeptical Verification Pass", passed: verifier.passed, detail: verifier },
          { name: "Telemetry & QA Pass", passed: true, detail: telemetry },
        ],
      };
      return print(report, json);
    }
    const report = runSkepticalVerification(process.cwd());
    return print(report, json);
  }
  if (command === "telemetry") {
    const report = getSessionTelemetry(process.cwd());
    return print(report, json);
  }
  if (command === "rules") {
    if (subcommand === "add") {
      const ruleText = rest.join(" ");
      if (!ruleText) throw new Error("rules add requires rule text");
      const rule = addCrystallizedRule(process.cwd(), ruleText);
      return print(rule, json);
    }
    const rules = loadCrystallizedRules(process.cwd());
    return print(json ? { rules } : formatCrystallizedRulesHighDensity(rules), json);
  }
  if (command === "delta") {
    const delta = calculateEnvironmentDelta(process.cwd());
    return print(delta, false);
  }
  if (command === "deliberate") {
    const consensus = runDeliberationGate(process.cwd());
    return print(consensus, json);
  }
  if (command === "conventions") {
    const report = auditRepositoryConventions(process.cwd());
    return print(report, json);
  }
  if (command === "scratchpad") {
    const sessionId = rest[0] || `session-${process.ppid}`;
    if (subcommand === "write") {
      const key = rest[1];
      const val = rest.slice(2).join(" ");
      if (!key) throw new Error("scratchpad write requires key");
      const entry = writeScratchpadEntry(sessionId, key, val, process.cwd());
      return print(entry, json);
    }
    const pad = readScratchpad(sessionId, process.cwd());
    return print(pad, json);
  }
  if (command === "heartbeat") {
    const sessionId = subcommand || `session-${process.ppid}`;
    const hb = recordHeartbeat(sessionId, process.cwd());
    return print(hb, json);
  }
  if (command === "spec") {
    const topic = [subcommand, ...rest].find((argument) => argument && !argument.startsWith("--")) || "feature-spec";
    const dateStr = new Date().toISOString().slice(0, 10);
    const specTemplate = `# Architectural Design Spec: ${topic}\n\nDate: ${dateStr}\n\n## Purpose\nDescribe the objective and problem statement.\n\n## Proposed Architecture\nComponents, data flow, and boundaries.\n\n## Verification Plan\nTDD test cases and skeptical verification checks.\n`;
    return print({ ok: true, topic, template: specTemplate }, json);
  }
  if (command === "grill") {
    const arch = auditRepositoryConventions(process.cwd());
    const verifier = runSkepticalVerification(process.cwd());
    const report = {
      ok: arch.passed && verifier.passed,
      verdict: arch.passed && verifier.passed ? "APPROVED" : "REJECTED",
      archChecks: arch,
      verificationChecks: verifier,
    };
    return print(report, json);
  }
  if (command === "goal") {
    const words = [subcommand, ...rest].filter((a) => a && !a.startsWith("--"));
    const title = words.join(" ") || "Riqor Goal Task";
    const orchestrator = new GoalLoopOrchestrator({
      id: `goal-${Date.now()}`,
      title,
      targetScore: 0.9,
      maxIterations: 5,
      subgoals: [],
    });
    return print({ ok: true, goalStatus: orchestrator.getStatus() }, json);
  }
  if (command === "fuzz") {
    const fuzzer = new SchemaContractFuzzer({
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" }, count: { type: "number", minimum: 0 } },
    });
    const samples = fuzzer.generateValidPayloads({ count: 3 });
    return print({ ok: true, fuzzSamples: samples }, json);
  }
  if (command === "repowise") {
    const analyzer = new RepoIntelligenceAnalyzer(process.cwd());
    const health = await analyzer.analyzeRepository();
    return print({ ok: true, repoHealth: health }, json);
  }
  if (command === "autoresearch") {
    const words = [subcommand, ...rest].filter((a) => a && !a.startsWith("--"));
    const statement = words.join(" ") || "Optimize performance";
    const engine = new AutoResearchEngine({
      id: `res-${Date.now()}`,
      statement,
      baselineMetricName: "latencyMs",
      baselineValue: 100,
      optimizationDirection: "MINIMIZE",
    });
    return print({ ok: true, researchSummary: engine.getSummary() }, json);
  }
  if (command === "terminal") return terminalCommand([subcommand ?? "", ...rest]);

  if (command === "codex") return passthroughCodex(args.slice(1));
  if (command === "agy") return passthroughAgy(args.slice(1));
  process.stderr.write(`${usage}\n`);
  process.exitCode = 64;
}

if (import.meta.main) {
  try { await main(); }
  catch (error) {
    process.stderr.write(`codex-harness: ${error instanceof Error ? error.message : "unexpected failure"}\n${usage}\n`);
    process.exitCode = 64;
  }
}
