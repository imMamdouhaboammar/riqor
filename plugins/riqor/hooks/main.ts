import {
  clearActivator,
  initializeActivator,
  observeActivatorStop,
  readActivatorConfig,
  touchActivator,
  type ActivatorStopResult,
} from "./activator";
import { routingContext } from "./router";
import { recordPluginAdoption } from "./adoption";
import {
  clearTurn,
  consumeEvidenceGate,
  markRuntimeSeen,
  pruneState,
  recordMutation,
  recordVerification,
  turnKey,
  type MutationKind,
  type VerificationScope,
} from "./state";

type HookInput = Record<string, unknown>;
type HookEnvironment = Record<string, string | undefined>;

const sessionContext = [
  "Riqor is a measured control plane around the model",
  "Define observable success, inspect the real flow, load only relevant skills, and make the smallest coherent change",
  "Fresh checks are required after observed mutations and all completion claims must name changed files, check outcomes, and unverified boundaries",
  "This plugin does not change model weights or prove AGI, determinism, or parity with another model",
].join("\n");

const activatorCheckpointReason = [
  "Riqor activator checkpoint: restore the current task and observable success criteria from this conversation",
  "Inspect relevant repository evidence such as status, diff, tests, and recent tool results",
  "Summarize only work actually completed",
  "Identify scope drift, repeated work, stale assumptions, missing checks, and unsupported completion claims",
  "Correct the plan and continue with the smallest relevant next action",
  "Preserve the current approval policy and do not introduce destructive actions merely because this checkpoint ran",
  "Keep the checkpoint concise and do not repeat the full conversation",
].join(". ");

const mutationTools = /^(?:apply_patch|write_file|edit_file|edit_block|multi_replace|create_file|delete_file)$/i;
const shellTools = /^(?:bash|shell|exec_command|run_shell_command|start_process|interact_with_process)$/i;
const docsExtension = /\.(?:md|mdx|rst|txt|adoc)$/i;
const configExtension = /(?:^|\/)(?:Dockerfile|Makefile)$|\.(?:json|ya?ml|toml|ini|cfg|conf|lock)$/i;
const codeExtension = /\.(?:c|cc|cpp|cs|css|go|h|html|java|js|jsx|kt|kts|php|py|rb|rs|scss|sh|sql|swift|ts|tsx|vue|xml)$/i;

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function commandFrom(input: HookInput) {
  const toolInput = object(input.tool_input);
  for (const key of ["command", "cmd", "script", "input"]) {
    if (typeof toolInput?.[key] === "string") return toolInput[key] as string;
  }
  return "";
}

function filePathsFromPatch(command: string) {
  return command.split("\n").flatMap((line) => {
    const match = line.match(/^\*\*\* (?:Add|Delete|Update) File: (.+)$/);
    return match ? [match[1]!.trim()] : [];
  });
}

function mutationKindForPaths(paths: string[]): MutationKind {
  if (paths.length === 0) return "unknown";
  if (paths.every((path) => docsExtension.test(path))) return "docs";
  if (paths.some((path) => codeExtension.test(path))) return "code";
  if (paths.some((path) => configExtension.test(path))) return "config";
  return "unknown";
}

function shellMutates(command: string) {
  return /(?:^|[;&|]\s*)(?:rm|mv|cp|touch|mkdir|install)\b|\b(?:sed\s+-i|perl\s+-pi|git\s+(?:checkout|restore|reset|clean|apply)|npm\s+install|pnpm\s+(?:add|install)|yarn\s+add)\b|(?:^|\s)(?:cat|printf|echo)\b[^\n]*(?:>>?|\|\s*tee\b)/i.test(command);
}

function observedMutation(input: HookInput): MutationKind | undefined {
  const toolName = String(input.tool_name ?? "");
  const command = commandFrom(input);
  if (/^apply_patch$/i.test(toolName)) return mutationKindForPaths(filePathsFromPatch(command));
  if (mutationTools.test(toolName)) return mutationKindForPaths(filePathsFromPatch(command));
  if (shellTools.test(toolName) && shellMutates(command)) return "unknown";
  return undefined;
}

function structuredExitCode(response: unknown) {
  const value = object(response);
  for (const candidate of [value?.exit_code, value?.exitCode, object(value?.metadata)?.exit_code, object(value?.output)?.exit_code]) {
    if (typeof candidate === "number" && Number.isInteger(candidate)) return candidate;
  }
  return undefined;
}

function normalizeCheckCommand(command: string) {
  let normalized = command.trim();
  const scopedDirectory = normalized.match(/^cd\s+(?:"[^"]+"|'[^']+'|[^\s;&|]+)\s*&&\s*/);
  if (scopedDirectory) normalized = normalized.slice(scopedDirectory[0].length);
  normalized = normalized.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s;&|]+)\s+)+/, "");
  return normalized.trim();
}

function verificationScope(input: HookInput): VerificationScope | undefined {
  if (!shellTools.test(String(input.tool_name ?? ""))) return undefined;
  if (structuredExitCode(input.tool_response) !== 0) return undefined;
  const normalized = normalizeCheckCommand(commandFrom(input));
  if (!normalized || /(?:\|\||&&|[;&|`]|\$\()/.test(normalized)) return undefined;
  if (/^git\s+diff\s+--check(?:\s|$)/i.test(normalized) || /^(?:npx\s+)?markdownlint\b/i.test(normalized)) return "docs";
  if (/^(?:bun\s+test\b|bun\s+run\s+[A-Za-z0-9:_-]*(?:build|check|lint|test|typecheck|validate)[A-Za-z0-9:_-]*\b)/i.test(normalized)) return "code";
  if (/^(?:(?:npm|pnpm|yarn)\s+(?:run\s+)?[A-Za-z0-9:_-]*(?:build|check|lint|test|typecheck|validate)[A-Za-z0-9:_-]*\b)/i.test(normalized)) return "code";
  if (/^(?:pytest\b|python\s+-m\s+pytest\b|cargo\s+test\b|go\s+test\b|dotnet\s+test\b|mvn\b[^\n]*\btest\b|gradle\S*\s+test\b|swift\s+test\b|xcodebuild\b[^\n]*\btest\b|phpunit\b)/i.test(normalized)) return "code";
  return undefined;
}

function promptFrom(input: HookInput) {
  for (const key of ["prompt", "user_prompt", "userPrompt", "message"]) {
    if (typeof input[key] === "string") return input[key] as string;
  }
  return "";
}

function evidenceReason(kind: MutationKind) {
  if (kind === "docs") return "Run a documentation check such as `git diff --check` or the project documentation linter";
  return "Run the smallest relevant test, build, lint, typecheck, or validation command with a structured zero exit";
}

async function boundedActivatorOperation<T>(operation: () => Promise<T>): Promise<T | undefined> {
  try {
    return await operation();
  } catch {
    return undefined;
  }
}

function activatorStopOutput(result: ActivatorStopResult | undefined): Record<string, unknown> {
  if (!result || result.kind === "none" || result.kind === "completed") return {};
  if (result.kind === "timeout") {
    return {
      systemMessage: `Riqor activator watchdog expired for checkpoint ${result.cycle}; the session was allowed to stop and the next interval was scheduled`,
    };
  }
  return {
    decision: "block",
    reason: `${activatorCheckpointReason}. Checkpoint cycle: ${result.cycle}`,
  };
}

export async function handleHook(
  input: HookInput,
  dataDir: string,
  environment: HookEnvironment = process.env,
  now = Date.now(),
): Promise<Record<string, unknown>> {
  const event = String(input.hook_event_name ?? "");
  const key = turnKey(input);
  const activator = readActivatorConfig(environment);
  const actionsFirst = environment.RIQOR_ACTIONS_FIRST === "1";
  const actionsFirstSuffix = actionsFirst
    ? "\n⚡ Actions-First Mode: Provide executable code, diffs, or commands FIRST. Omit conversational fluff. Max 3 bullet points summary.\n✂️ Ponytail YAGNI Filter: Apply 6-step filter (Skip -> Native -> Reuse -> Existing Dep -> One-liner -> Minimal diff) before creating code."
    : "";

  if (event === "SessionStart") {
    await boundedActivatorOperation(() => recordPluginAdoption(dataDir, "session", now));
    await pruneState(dataDir);
    await markRuntimeSeen(dataDir, now);
    if (activator) await boundedActivatorOperation(() => initializeActivator(dataDir, activator, now));
    return { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: `${sessionContext}${actionsFirstSuffix}` } };
  }

  if (event === "UserPromptSubmit") {
    if (activator) await boundedActivatorOperation(() => touchActivator(dataDir, activator, now));
    return {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: `${routingContext(promptFrom(input))}${actionsFirstSuffix}`,
      },
    };
  }

  if (event === "SubagentStart") {
    await boundedActivatorOperation(() => recordPluginAdoption(dataDir, "agentStart", now));
    return {
      hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext: "Work independently from the evidence and do not inherit a parent agent verdict without checking it",
      },
    };
  }

  if (event === "PostToolUse") {
    const mutationKind = observedMutation(input);
    if (mutationKind) await recordMutation(dataDir, key, mutationKind, now);
    else {
      const scope = verificationScope(input);
      if (scope) await recordVerification(dataDir, key, now, scope);
    }
    if (activator) await boundedActivatorOperation(() => touchActivator(dataDir, activator, now));
    return {};
  }

  if (event === "Stop") {
    if (input.stop_hook_active === true) {
      await clearTurn(dataDir, key);
      if (!activator) return {};
      const result = await boundedActivatorOperation(() => observeActivatorStop(dataDir, activator, now, false));
      return activatorStopOutput(result);
    }

    const gate = await consumeEvidenceGate(dataDir, key);
    if (gate.pending) {
      if (gate.firstBlock) {
        return {
          decision: "block",
          reason: `Riqor evidence gate: a ${gate.mutationKind} mutation was observed after the last accepted check. ${evidenceReason(gate.mutationKind)}. Then finish with changed files, exact check outcomes, and anything not verified`,
        };
      }
      return {
        systemMessage: "Riqor allowed completion after one evidence reminder and cleared its pending state. Any missing check must be disclosed as not verified",
      };
    }

    if (!activator) return {};
    const result = await boundedActivatorOperation(() => observeActivatorStop(dataDir, activator, now, true));
    return activatorStopOutput(result);
  }

  if (event === "SessionEnd") {
    await clearTurn(dataDir, key);
    if (activator) await boundedActivatorOperation(() => clearActivator(dataDir, activator));
  }

  return {};
}

import { isMainModule, readStdinText } from "./io";

if (isMainModule(import.meta.url)) {
  try {
    const dataDir = process.env.PLUGIN_DATA;
    if (!dataDir) throw new Error("PLUGIN_DATA is required");
    const rawText = typeof Bun !== "undefined" && Bun.stdin ? await Bun.stdin.text() : await readStdinText();
    const input = JSON.parse(rawText) as HookInput;
    const output = await handleHook(input, dataDir);
    if (Object.keys(output).length > 0) process.stdout.write(JSON.stringify(output));
  } catch {
    process.stdout.write(JSON.stringify({ systemMessage: "Riqor skipped a local hook because bounded state was unavailable" }));
  }
}
