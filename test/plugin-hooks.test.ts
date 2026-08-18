import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleHook } from "../plugins/riqor/hooks/main";

const roots: string[] = [];
async function dataDir() {
  const root = await mkdtemp(join(tmpdir(), "codex-self-improvement-hook-"));
  roots.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const common = { session_id: "session", turn_id: "turn", model: "gpt", permission_mode: "never" };

describe("plugin lifecycle hook", () => {
  test("adds compact session guidance", async () => {
    const root = await dataDir();
    const output = await handleHook({ ...common, hook_event_name: "SessionStart", source: "startup" }, root);
    expect(output).toEqual({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: expect.stringContaining("measured control plane"),
      },
    });
    expect(JSON.parse(await readFile(join(root, "runtime.json"), "utf8"))).toMatchObject({ event: "SessionStart" });
  });

  test("routes a submitted prompt without retaining it", async () => {
    const root = await dataDir();
    const output = await handleHook(
      { ...common, hook_event_name: "UserPromptSubmit", prompt: "CUSTOMER_XYZZY fix the intermittent cache bug" },
      root,
    );
    expect(output).toMatchObject({
      hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: expect.stringContaining("Profile: debugging") },
    });
    const names = await readdir(root);
    const contents = await Promise.all(names.map((name) => readFile(join(root, name), "utf8")));
    expect(names.join("\n")).not.toContain("CUSTOMER_XYZZY");
    expect(contents.join("\n")).not.toContain("CUSTOMER_XYZZY");
  });

  test("records only coarse local session and subagent adoption counters", async () => {
    const root = await dataDir();
    await handleHook({ ...common, hook_event_name: "SessionStart", source: "startup" }, root, {}, Date.parse("2026-08-09T10:00:00Z"));
    await handleHook({ ...common, hook_event_name: "SubagentStart", agent_type: "reviewer", prompt: "SENSITIVE_MARKER" }, root, {}, Date.parse("2026-08-09T10:01:00Z"));
    const names = await readdir(root);
    expect(names).toContain("adoption.json");
    if (!names.includes("adoption.json")) return;
    const ledger = JSON.parse(await readFile(join(root, "adoption.json"), "utf8"));
    expect(ledger).toMatchObject({ schemaVersion: 1, sessions: 1, agentStarts: 1, activeDayCount: 1 });
    expect(JSON.stringify(ledger)).not.toContain("SENSITIVE_MARKER");
    expect(JSON.stringify(ledger)).not.toContain("reviewer");
  });

  test("blocks completion after a code mutation until a later successful check", async () => {
    const root = await dataDir();
    await handleHook({
      ...common,
      hook_event_name: "PostToolUse",
      tool_name: "apply_patch",
      tool_input: { command: "*** Update File: src/cache.ts\n+export const value = 1" },
      tool_response: { success: true },
    }, root);
    expect(await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: false }, root)).toMatchObject({ decision: "block" });

    await handleHook({
      ...common,
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "cd app && CI=1 bun test" },
      tool_response: { exit_code: 0 },
    }, root);
    expect(await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: false }, root)).toEqual({});
  });

  test("observes Codex App and remote terminal mutation tools without trusting prose-only checks", async () => {
    const root = await dataDir();
    await handleHook({
      ...common,
      hook_event_name: "PostToolUse",
      tool_name: "start_process",
      tool_input: { command: "printf x > src/remote.ts" },
      tool_response: { text: "Process finished successfully" },
    }, root);
    expect(await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: false }, root)).toMatchObject({ decision: "block" });

    await handleHook({
      ...common,
      hook_event_name: "PostToolUse",
      tool_name: "interact_with_process",
      tool_input: { input: "bun test" },
      tool_response: { text: "all tests passed" },
    }, root);
    expect(await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: true }, root)).toEqual({});
  });

  test("does not accept masked, failed, or prose-only check claims", async () => {
    const root = await dataDir();
    const mutate = () => handleHook({
      ...common,
      hook_event_name: "PostToolUse",
      tool_name: "apply_patch",
      tool_input: { command: "*** Update File: src/auth.ts" },
      tool_response: {},
    }, root);

    for (const candidate of [
      { command: "bun test || true", response: { exit_code: 0 } },
      { command: "bun test", response: { exit_code: 1 } },
      { command: "bun test", response: "all good" },
    ]) {
      await mutate();
      await handleHook({
        ...common,
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: candidate.command },
        tool_response: candidate.response,
      }, root);
      expect(await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: false }, root)).toMatchObject({ decision: "block" });
      await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: true }, root);
    }
  });

  test("does not accept unrelated scripts whose names merely contain a check word", async () => {
    const root = await dataDir();
    await handleHook({
      ...common,
      hook_event_name: "PostToolUse",
      tool_name: "apply_patch",
      tool_input: { command: "*** Update File: src/auth.ts" },
      tool_response: {},
    }, root);
    await handleHook({
      ...common,
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "bun run contest" },
      tool_response: { exit_code: 0 },
    }, root);
    expect(await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: false }, root))
      .toMatchObject({ decision: "block" });
  });

  test("accepts a documentation sanity check for documentation-only edits", async () => {
    const root = await dataDir();
    await handleHook({
      ...common,
      hook_event_name: "PostToolUse",
      tool_name: "apply_patch",
      tool_input: { command: "*** Update File: README.md\n+Usage" },
      tool_response: {},
    }, root);
    await handleHook({
      ...common,
      hook_event_name: "PostToolUse",
      tool_name: "shell",
      tool_input: { command: "git diff --check" },
      tool_response: { exitCode: 0 },
    }, root);
    expect(await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: false }, root)).toEqual({});
  });

  test("a later mutation invalidates earlier verification and the gate blocks once", async () => {
    const root = await dataDir();
    const post = (command: string, response: unknown = {}) => handleHook({
      ...common,
      hook_event_name: "PostToolUse",
      tool_name: command.startsWith("***") ? "apply_patch" : "Bash",
      tool_input: { command },
      tool_response: response,
    }, root);
    await post("*** Update File: src/a.ts");
    await post("bun test", { exit_code: 0 });
    await post("*** Update File: src/b.ts");
    expect(await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: false }, root)).toMatchObject({ decision: "block" });
    const secondStop = await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: false }, root);
    expect(secondStop.systemMessage).toContain("allowed completion after one evidence reminder");
  });
});
