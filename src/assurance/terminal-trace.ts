import { inspectRepositoryIdentity } from "./repository-identity";
import {
  appendRunEvent,
  readActiveRun,
  readRun,
} from "./recovering-run-store";
import type { RiqorRun } from "./types";
import type { TerminalPostexecTransition } from "../terminal-runtime";

export type RecordActiveRunTerminalTransitionOptions = Readonly<{
  stateRoot: string;
  cwd: string;
  transition: TerminalPostexecTransition;
  now?: Date;
}>;

export async function recordActiveRunTerminalTransition(
  options: RecordActiveRunTerminalTransitionOptions,
): Promise<RiqorRun | null> {
  const identity = await inspectRepositoryIdentity(options.cwd);
  const active = await readActiveRun({ stateRoot: options.stateRoot, identity });
  if (!active) return null;

  const location = {
    stateRoot: options.stateRoot,
    identity,
    runId: active.runId,
  } as const;
  const durationMs = Math.max(0, options.transition.completedAt - options.transition.startedAt);
  const commandSucceeded = options.transition.exitCode === 0;

  await appendRunEvent({
    ...location,
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
  });

  if (options.transition.kind === "mutation" && commandSucceeded) {
    await appendRunEvent({
      ...location,
      source: "terminal",
      type: "workspace_mutated",
      status: "success",
      subject: options.transition.route,
      digest: options.transition.commandDigest,
      metadata: {
        repositoryHead: identity.headSha,
        repositoryDirty: identity.dirty,
      },
      now: options.now,
    });
    await appendRunEvent({
      ...location,
      source: "terminal",
      type: "verification_required",
      status: "pending",
      subject: options.transition.route,
      digest: options.transition.commandDigest,
      nextStatus: "verification-pending",
      now: options.now,
    });
  }

  if (options.transition.kind === "verification" && commandSucceeded) {
    const current = await readRun(location);
    if (current.status === "verification-pending") {
      await appendRunEvent({
        ...location,
        source: "terminal",
        type: "verification_completed",
        status: "success",
        subject: options.transition.route,
        digest: options.transition.commandDigest,
        metadata: {
          repositoryHead: identity.headSha,
          repositoryDirty: identity.dirty,
        },
        nextStatus: "active",
        now: options.now,
      });
    }
  }

  return readRun(location);
}
