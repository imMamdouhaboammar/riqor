import { describe, expect, it } from "bun:test";
import { executeLifecycleHooks, registerLifecycleHook } from "../src/lifecycle-hooks.js";

describe("lifecycle hooks engine", () => {
  it("executes hooks and allows when all handlers pass", async () => {
    registerLifecycleHook("PreToolUse", () => ({ allow: true }));
    const decision = await executeLifecycleHooks({
      sessionId: "test-session",
      repoRoot: process.cwd(),
      event: "PreToolUse",
    });
    expect(decision.allow).toBe(true);
  });

  it("short-circuits and denies when a hook returns allow: false", async () => {
    registerLifecycleHook("Stop", () => ({ allow: false, reason: "Verification pending" }));
    const decision = await executeLifecycleHooks({
      sessionId: "test-session",
      repoRoot: process.cwd(),
      event: "Stop",
    });
    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe("Verification pending");
  });
});
