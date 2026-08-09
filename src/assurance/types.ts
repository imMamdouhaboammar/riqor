import type { HarnessPathId } from "../../plugins/riqor/hooks/paths";

export type ExecutionProfileId = "standard" | "assured";

export type RiqorRunStatus =
  | "active"
  | "verification-pending"
  | "completed"
  | "failed"
  | "abandoned";

export type PersistedRepositoryIdentity = Readonly<{
  rootDigest: string;
  headSha: string | null;
  dirty: boolean;
}>;

export type RiqorRun = Readonly<{
  schemaVersion: 1;
  runId: string;
  runGroupId: string;
  parentRunId?: string;
  goal: string;
  pathId: HarnessPathId;
  profileId: ExecutionProfileId;
  status: RiqorRunStatus;
  repository: PersistedRepositoryIdentity;
  nextSequence: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}>;

export type RiqorTraceEventType =
  | "run_started"
  | "command_completed"
  | "workspace_mutated"
  | "verification_required"
  | "verification_completed"
  | "run_completed";

export type RiqorTraceEventStatus = "pending" | "success" | "failure";

export type RiqorTraceMetadataValue = string | number | boolean | null;

export type RiqorTraceEvent = Readonly<{
  schemaVersion: 1;
  eventId: string;
  sequence: number;
  runId: string;
  runGroupId: string;
  source: "riqor" | "terminal";
  type: RiqorTraceEventType;
  status: RiqorTraceEventStatus;
  timestamp: string;
  subject?: string;
  digest?: string;
  evidenceRefs?: readonly string[];
  metadata?: Readonly<Record<string, RiqorTraceMetadataValue>>;
}>;
