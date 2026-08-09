import { createHash } from "node:crypto";

export interface EvidencePackInput {
  sessionId: string;
  repository: string;
  commitSha: string;
  passRate: number;
  testsExecuted: number;
  testsPassed: number;
  durationMs: number;
  diagnosticsCount: number;
  securityScanPassed: boolean;
  modifiedFiles: string[];
}

export interface EvidencePackPayload {
  metadata: {
    sessionId: string;
    repository: string;
    commitSha: string;
    timestampIso: string;
  };
  metrics: {
    passRate: number;
    testsExecuted: number;
    testsPassed: number;
    durationMs: number;
    diagnosticsCount: number;
    securityScanPassed: boolean;
  };
  artifacts: {
    modifiedFiles: string[];
  };
  integrityHash: string;
  toonRepresentation: string;
}

function computePayloadHash(payload: Omit<EvidencePackPayload, "integrityHash" | "toonRepresentation">): string {
  const normalizedString = JSON.stringify(payload);
  return createHash("sha256").update(normalizedString).digest("hex");
}

function formatToonRepresentation(payload: Omit<EvidencePackPayload, "integrityHash" | "toonRepresentation">, hash: string): string {
  return [
    `=== RIQOR EVIDENCE PACK ===`,
    `SESSION: ${payload.metadata.sessionId}`,
    `REPOSITORY: ${payload.metadata.repository}`,
    `COMMIT: ${payload.metadata.commitSha}`,
    `TIMESTAMP: ${payload.metadata.timestampIso}`,
    `PASS_RATE: ${payload.metrics.passRate.toFixed(2)}`,
    `TESTS: ${payload.metrics.testsPassed}/${payload.metrics.testsExecuted}`,
    `SECURITY_SCAN: ${payload.metrics.securityScanPassed ? "PASSED" : "FAILED"}`,
    `DIAGNOSTICS: ${payload.metrics.diagnosticsCount}`,
    `FILES_MODIFIED: ${payload.artifacts.modifiedFiles.join(", ")}`,
    `INTEGRITY_HASH: ${hash}`,
  ].join("\n");
}

export function generateEvidencePack(input: EvidencePackInput): EvidencePackPayload {
  const timestampIso = new Date().toISOString();

  const corePayload = {
    metadata: {
      sessionId: input.sessionId,
      repository: input.repository,
      commitSha: input.commitSha,
      timestampIso,
    },
    metrics: {
      passRate: input.passRate,
      testsExecuted: input.testsExecuted,
      testsPassed: input.testsPassed,
      durationMs: input.durationMs,
      diagnosticsCount: input.diagnosticsCount,
      securityScanPassed: input.securityScanPassed,
    },
    artifacts: {
      modifiedFiles: [...input.modifiedFiles].sort(),
    },
  };

  const integrityHash = computePayloadHash(corePayload);
  const toonRepresentation = formatToonRepresentation(corePayload, integrityHash);

  return {
    ...corePayload,
    integrityHash,
    toonRepresentation,
  };
}

export function verifyEvidencePackIntegrity(pack: EvidencePackPayload): boolean {
  const { integrityHash, toonRepresentation, ...corePayload } = pack;
  const expectedHash = computePayloadHash(corePayload);
  return expectedHash === integrityHash;
}
