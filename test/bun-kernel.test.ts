import { describe, expect, it } from "bun:test";
import { executeKernelCommand } from "../src/bun-kernel.js";

describe("bun execution kernel", () => {
  it("executes valid command with bun primitives", () => {
    const result = executeKernelCommand(["echo", "hello riqor"], process.cwd());
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello riqor");
    expect(typeof result.durationMs).toBe("number");
  });

  it("handles non-zero exit codes gracefully", () => {
    const result = executeKernelCommand(["false"], process.cwd());
    expect(result.exitCode).not.toBe(0);
  });
  it("reports a signal-terminated command as failure", () => {
    const result = executeKernelCommand(["sh", "-c", "kill -TERM $$"], process.cwd());
    expect(result.exitCode).not.toBe(0);
  });

});
