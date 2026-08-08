import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
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

const layout = resolveRuntimeLayout();
const root = layout.runtimeRoot;
const pluginRoot = layout.pluginRoot;
const pluginId = "codex-self-improvement@codex-self-improvement-dev";
const usage = "usage: codex-harness <version|status|doctor|paths list|run start|status|complete|trace show|export|plugin status|install|uninstall|shell status|install|uninstall|terminal preexec|postexec|status|codex> [options]; codex activator: --activator [--actions-first] [--activator-interval 15m] [--activator-watchdog 3m]";

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

function print(value: unknown, json: boolean) {
  process.stdout.write(json ? `${JSON.stringify(value, null, 2)}\n` : `${String(value)}\n`);
}

function run(command: string[], options: { cwd?: string; env?: Record<string, string | undefined> } = {}) {
  const result = Bun.spawnSync(command, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  };
}

async function exists(path: string) {
  try { await access(path, constants.R_OK); return true; } catch { return false; }
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
  const kaku = run(["kaku", "--version"]);
  return {
    ...(await versionRecord()),
    root,
    codex: { available: codex.exitCode === 0, version: codex.stdout || null },
    kaku: { available: kaku.exitCode === 0, version: kaku.stdout || null },
    plugin: pluginInventory(),
    shell: await shellInventory(),
    surfaces: {
      codexApp: "native-plugin-shared-CODEX_HOME",
      codexCli: "native-plugin-shared-CODEX_HOME",
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
  const checks: Check[] = [
    { id: "codex-cli", ok: (status.codex as any).available, detail: (status.codex as any).version ?? "missing" },
    { id: "codex-core", ok: codexAssessment.coreOk, detail: codexAssessment.coreOk ? `core passed; overall ${codexAssessment.overallStatus}` : `core failed; overall ${codexAssessment.overallStatus}` },
    { id: "plugin-installed", ok: plugin.installed === true, detail: String(plugin.version ?? "missing") },
    { id: "plugin-enabled", ok: plugin.enabled === true, detail: plugin.enabled === true ? "enabled" : "disabled" },
    { id: "plugin-health", ok: health.exitCode === 0, detail: health.exitCode === 0 ? "passed" : health.stderr || "failed" },
    { id: "shell-executable", ok: shell.executable === true, detail: shell.executable === true ? "installed" : "missing" },
    { id: "shell-environment", ok: shell.environment === true, detail: shell.environment === true ? "installed" : "missing" },
    { id: "kaku-plugin", ok: shell.kakuPlugin === true, detail: shell.kakuPlugin === true ? "installed" : "missing" },
    { id: "kaku-doctor", ok: kakuDoctor.exitCode === 0 && !/\b(?:WARN|FAIL)\b/.test(kakuDoctor.stdout), detail: kakuDoctor.exitCode === 0 ? "completed" : kakuDoctor.stderr || "failed" },
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

async function lifecycle(script: string) {
  const child = Bun.spawn(["bash", join(layout.scriptsRoot, script)], {
    cwd: root,
    env: process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exitCode = await child.exited;
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
  if (command === "verify") {
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
  if (command === "terminal") return terminalCommand([subcommand ?? "", ...rest]);
  if (command === "codex") return passthroughCodex(args.slice(1));
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
