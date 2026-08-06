import {
  inspectRepositoryIdentity,
  locateRepositoryIdentity,
  type RepositoryIdentity,
  type RepositoryLocation,
} from "./repository-identity";
import { appendRunEvents, readActiveRun, type RunEventInput } from "./run-store";
import type { RiqorRun, RiqorTraceMetadataValue } from "./types";
import type { TerminalPostexecTransition } from "../terminal-runtime";

export type RecordActiveRunTerminalTransitionOptions = Readonly<{
  stateRoot: string;
  cwd: string;
  transition: TerminalPostexecTransition;
  now?: Date;
  locateRepository?: typeof locateRepositoryIdentity;
  inspectRepository?: typeof inspectRepositoryIdentity;
  failureMode?: "isolate" | "throw";
  onWarning?: (error: Error) => void;
}>;

function locationIdentity(location: RepositoryLocation): RepositoryIdentity {
  return Object.freeze({
    rootDigest: location.rootDigest,
    rootPath: location.rootPath,
    headSha: null,
    dirty: false,
  });
}

async function recordActiveRunTerminalTransitionStrict(
  options: RecordActiveRunTerminalTransitionOptions,
): Promise<RiqorRun | null> {
  const locateRepository = options.locateRepository ?? locateRepositoryIdentity;
  const inspectRepository = options.inspectRepository ?? inspectRepositoryIdentity;
  const location = await locateRepository(options.cwd);
  const lookupIdentity = locationIdentity(location);
  const active = await readActiveRun({
    stateRoot: options.stateRoot,
    identity: lookupIdentity,
  });
  if (!active) return null;

  const commandSucceeded = options.transition.exitCode === 0;
  const needsRepositoryMetadata = commandSucceeded
    && ["mutation", "verification"].includes(options.transition.kind);
  let identity = lookupIdentity;
  let repositoryMetadata: Readonly<Record<string, RiqorTraceMetadataValue>> = {
    repositoryInspection: "not-required",
  };
  if (needsRepositoryMetadata) {
    try {
      identity = await inspectRepository(options.cwd, { location });
      repositoryMetadata = {
        repositoryHead: identity.headSha,
        repositoryDirty: identity.dirty,
      };
    } catch {
      repositoryMetadata = { repositoryInspection: "unavailable" };
    }
  }

  const durationMs = Math.max(0, options.transition.completedAt - options.transition.startedAt);
  const events: RunEventInput[] = [{
    source: "terminal",
    type: "command_completed",
    status: commandSucceeded ? "success" : "failure",
    subject: options.transition.kind,
    digest: options.transition.commandDigest,
    metadata: {
      kind: options.transition.kind,
      route: options.transition.route,
      exitCode: options.transition.exitCode,
      durationMs,
    },
    now: options.now,
  }];

  if (options.transition.kind === "mutation" && commandSucceeded) {
    events.push({
      source: "terminal",
      type: "workspace_mutated",
      status: "success",
      subject: options.transition.route,
      digest: options.transition.commandDigest,
      metadata: repositoryMetadata,
      now: options.now,
    });
    events.push({
      source: "terminal",
      type: "verification_required",
      status: "pending",
      subject: options.transition.route,
      digest: options.transition.commandDigest,
      metadata: {},
      nextStatus: "verification-pending",
      now: options.now,
    });
  } else if (options.transition.kind === "verification" && commandSucceeded) {
    events.push({
      source: "terminal",
      type: "verification_completed",
      status: "success",
      subject: options.transition.route,
      digest: options.transition.commandDigest,
      metadata: repositoryMetadata,
      whenStatus: "verification-pending",
      nextStatus: "active",
      now: options.now,
    });
  }

  const result = await appendRunEvents({
    stateRoot: options.stateRoot,
    identity,
    runId: active.runId,
    events,
  });
  return result.run;
}

export async function recordActiveRunTerminalTransition(
  options: RecordActiveRunTerminalTransitionOptions,
): Promise<RiqorRun | null> {
  try {
    return await recordActiveRunTerminalTransitionStrict(options);
  } catch (cause) {
    if (options.failureMode === "throw") throw cause;
    const error = cause instanceof Error ? cause : new Error("unexpected trace failure");
    if (options.onWarning) options.onWarning(error);
    else process.stderr.write(`Riqor warning: terminal trace was not recorded: ${error.message}\n`);
    return null;
  }
}
