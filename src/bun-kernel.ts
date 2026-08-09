import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
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
    const [file, ...args] = command;
    if (!file) throw new Error("No executable specified");
    const proc = spawnSync(file, args, {
      cwd: resolvedCwd,
      encoding: "utf8",
      timeout: timeoutMs,
    });

    const durationMs = Date.now() - startTime;
    const stderr = (proc.stderr ?? "").trim();
    return {
      exitCode: typeof proc.status === "number" ? proc.status : 1,
      stdout: (proc.stdout ?? "").trim(),
      stderr: stderr || proc.error?.message?.trim() || "",
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
