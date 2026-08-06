import { harnessPaths, type HarnessPathId } from "../../plugins/codex-self-improvement/hooks/paths";
import {
  inspectRepositoryIdentity,
  resolveRiqorStateRoot,
} from "./repository-identity";
import {
  completeRun,
  createRun,
  readActiveRun,
  readRun,
  readRunEvents,
} from "./run-store";
import type { ExecutionProfileId, RiqorRun, RiqorTraceEvent } from "./types";

export type AssuranceCommandOptions = Readonly<{
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdout?: Pick<NodeJS.WriteStream, "write">;
  now?: Date;
  randomId?: () => string;
}>;

const PATH_IDS = new Set(harnessPaths.map((path) => path.id));
const PROFILES = new Set<ExecutionProfileId>(["standard", "assured"]);

function has(args: readonly string[], flag: string) {
  return args.includes(flag);
}

function value(args: readonly string[], flag: string) {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  const selected = args[index + 1];
  if (!selected || selected.startsWith("--")) throw new Error(`${flag} requires a value`);
  return selected;
}

function validatePath(value: string | undefined): HarnessPathId {
  const selected = value ?? "evidence-loop";
  if (!PATH_IDS.has(selected as HarnessPathId)) throw new Error(`unknown harness path: ${selected}`);
  return selected as HarnessPathId;
}

function validateProfile(value: string | undefined): ExecutionProfileId {
  const selected = value ?? "standard";
  if (!PROFILES.has(selected as ExecutionProfileId)) throw new Error(`unknown execution profile: ${selected}`);
  return selected as ExecutionProfileId;
}

function formatRun(run: RiqorRun | null) {
  if (!run) return "no active run";
  return [
    `run ${run.runId}`,
    `status ${run.status}`,
    `path ${run.pathId}`,
    `profile ${run.profileId}`,
    `head ${run.repository.headSha ?? "unavailable"}`,
  ].join("\n");
}

function formatEvents(events: readonly RiqorTraceEvent[]) {
  if (events.length === 0) return "no trace events";
  return events
    .map((event) => `${event.sequence}\t${event.timestamp}\t${event.status}\t${event.type}`)
    .join("\n");
}

function print(
  stream: Pick<NodeJS.WriteStream, "write">,
  output: unknown,
  json: boolean,
  human: () => string,
) {
  stream.write(json ? `${JSON.stringify(output, null, 2)}\n` : `${human()}\n`);
}

export async function assuranceCommand(
  args: string[],
  options: AssuranceCommandOptions = {},
): Promise<boolean> {
  const [command, subcommand] = args;
  if (command !== "run" && command !== "trace") return false;

  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const stdout = options.stdout ?? process.stdout;
  const stateRoot = resolveRiqorStateRoot(env);
  const identity = await inspectRepositoryIdentity(cwd);
  const json = has(args, "--json");

  if (command === "run" && subcommand === "start") {
    const goal = value(args, "--goal");
    if (goal === undefined) throw new Error("run start requires --goal");
    const run = await createRun({
      stateRoot,
      identity,
      goal,
      pathId: validatePath(value(args, "--path")),
      profileId: validateProfile(value(args, "--profile")),
      parentRunId: value(args, "--parent-run"),
      now: options.now,
      randomId: options.randomId,
    });
    print(stdout, run, json, () => formatRun(run));
    return true;
  }

  if (command === "run" && subcommand === "status") {
    const runId = value(args, "--run");
    const run = runId
      ? await readRun({ stateRoot, identity, runId })
      : await readActiveRun({ stateRoot, identity });
    print(stdout, run, json, () => formatRun(run));
    return true;
  }

  if (command === "run" && subcommand === "complete") {
    const explicitRunId = value(args, "--run");
    const active = explicitRunId
      ? await readRun({ stateRoot, identity, runId: explicitRunId })
      : await readActiveRun({ stateRoot, identity });
    if (!active) throw new Error("no active run");
    const run = await completeRun({
      stateRoot,
      identity,
      runId: active.runId,
      now: options.now,
      randomId: options.randomId,
    });
    print(stdout, run, json, () => formatRun(run));
    return true;
  }

  if (command === "run") throw new Error("run requires start, status, or complete");

  const runId = args[2];
  if (!runId || runId.startsWith("--")) throw new Error(`trace ${subcommand ?? "command"} requires a run id`);

  if (subcommand === "show") {
    const events = await readRunEvents({ stateRoot, identity, runId });
    print(stdout, events, json, () => formatEvents(events));
    return true;
  }

  if (subcommand === "export") {
    const format = value(args, "--format") ?? "jsonl";
    if (format !== "jsonl") throw new Error("trace export supports only jsonl");
    const events = await readRunEvents({ stateRoot, identity, runId });
    for (const event of events) stdout.write(`${JSON.stringify(event)}\n`);
    return true;
  }

  throw new Error("trace requires show or export");
}
