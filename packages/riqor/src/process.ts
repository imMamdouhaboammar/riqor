import { execFile } from "node:child_process";

export type RunOptions = Readonly<{
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}>;

export type CommandResult = Readonly<{
  exitCode: number;
  stdout: string;
  stderr: string;
}>;

export function runCommand(command: string[], options: RunOptions = {}): Promise<CommandResult> {
  return new Promise((resolve) => {
    const [file, ...args] = command;
    if (!file) {
      return resolve({ exitCode: 1, stdout: "", stderr: "No executable specified" });
    }
    execFile(
      file,
      args,
      {
        cwd: options.cwd ?? process.cwd(),
        env: { ...process.env, ...options.env },
        timeout: options.timeoutMs ?? 30000,
        encoding: "utf8",
      },
      (error, stdout, stderr) => {
        const exitCode = error ? (typeof error.code === "number" ? error.code : 1) : 0;
        resolve({
          exitCode,
          stdout: (stdout || "").trim(),
          stderr: (stderr || "").trim(),
        });
      }
    );
  });
}
