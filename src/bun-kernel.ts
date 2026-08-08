import { resolve } from "node:path";
import { assertIsolatableRepo } from "./checks.js";

export interface KernelExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export function executeKernelCommand(
  command: string[],
  cwd: string = process.cwd(),
  timeoutMs: number = 60_000,
): KernelExecutionResult {
  const resolvedCwd = resolve(cwd);
  assertIsolatableRepo(resolvedCwd);

  const startTime = Date.now();
  try {
    const proc = Bun.spawnSync(command, {
      cwd: resolvedCwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const durationMs = Date.now() - startTime;
    return {
      exitCode: proc.exitCode ?? 1,
      stdout: proc.stdout ? proc.stdout.toString().trim() : "",
      stderr: proc.stderr ? proc.stderr.toString().trim() : "",
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    return {
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : "Kernel execution failed",
      durationMs,
    };
  }
}
