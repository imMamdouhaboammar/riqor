import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { runSkepticalVerification, type SkepticalVerificationResult } from "./skeptical-verifier.js";

export interface SessionTelemetry {
  repositoryRoot: string;
  timestamp: string;
  activeBranch: string;
  latestCommitHash: string;
  latestCommitMessage: string;
  verification: SkepticalVerificationResult;
  metrics: {
    uncommittedFilesCount: number;
    linesInserted: number;
    linesDeleted: number;
    filesChanged: number;
  };
}

export function getSessionTelemetry(repoRoot: string = process.cwd()): SessionTelemetry {
  const resolvedRoot = resolve(repoRoot);
  const verification = runSkepticalVerification(resolvedRoot);

  let activeBranch = "unknown";
  let latestCommitHash = "unknown";
  let latestCommitMessage = "unknown";

  try {
    activeBranch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: resolvedRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    latestCommitHash = execSync("git rev-parse --short HEAD", {
      cwd: resolvedRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    latestCommitMessage = execSync("git log -1 --pretty=%B", {
      cwd: resolvedRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    // Non-fatal git query error fallback
  }

  return {
    repositoryRoot: resolvedRoot,
    timestamp: new Date().toISOString(),
    activeBranch,
    latestCommitHash,
    latestCommitMessage,
    verification,
    metrics: {
      uncommittedFilesCount: verification.uncommittedFiles.length,
      linesInserted: verification.diffSummary.insertions,
      linesDeleted: verification.diffSummary.deletions,
      filesChanged: verification.diffSummary.filesChanged,
    },
  };
}

export interface McpJsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export function handleMcpRequest(request: McpJsonRpcRequest, repoRoot: string = process.cwd()): object {
  if (request.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        tools: [
          {
            name: "riqor_get_session_telemetry",
            description: "Get local-first session execution telemetry, verification status, and workspace velocity metrics.",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ],
      },
    };
  }

  if (request.method === "tools/call") {
    const params = request.params as { name?: string } | undefined;
    if (params?.name === "riqor_get_session_telemetry") {
      const telemetry = getSessionTelemetry(repoRoot);
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(telemetry, null, 2),
            },
          ],
        },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id: request.id,
    error: {
      code: -32601,
      message: `Method '${request.method}' not found`,
    },
  };
}
