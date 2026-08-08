import { describe, expect, it } from "bun:test";
import { executeKernelCommand } from "../src/bun-kernel.js";
import { auditRepositoryConventions } from "../src/convention-auditor.js";
import { runDeliberationGate } from "../src/deliberation-gate.js";
import { executeLifecycleHooks, registerLifecycleHook } from "../src/lifecycle-hooks.js";
import { recordHeartbeat, writeScratchpadEntry } from "../src/scratchpad-isolation.js";

describe("riqor part II CLI capability integrations", () => {
  it("executes bun kernel command", () => {
    const res = executeKernelCommand(["echo", "kernel test"], process.cwd());
    expect(res.exitCode).toBe(0);
  });

  it("runs convention auditor", () => {
    const report = auditRepositoryConventions(process.cwd());
    expect(Array.isArray(report.checks)).toBe(true);
  });

  it("runs deliberation gate", () => {
    const consensus = runDeliberationGate(process.cwd());
    expect(consensus).toHaveProperty("consensus");
  });

  it("records session heartbeat and scratchpad", () => {
    const hb = recordHeartbeat("cli-session-test", process.cwd());
    expect(hb.active).toBe(true);
    const sp = writeScratchpadEntry("cli-session-test", "key1", "val1", process.cwd());
    expect(sp.key).toBe("key1");
  });

  it("executes lifecycle hooks", async () => {
    registerLifecycleHook("SessionStart", () => ({ allow: true }));
    const dec = await executeLifecycleHooks({
      sessionId: "s1",
      repoRoot: process.cwd(),
      event: "SessionStart",
    });
    expect(dec.allow).toBe(true);
  });
});
