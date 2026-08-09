import { expect, test } from "bun:test";
import { parseCodexActivatorArgs, buildCodexEnvironment } from "../src/harness-cli";
import { handleHook } from "../plugins/riqor/hooks/main";
import { harnessPaths } from "../plugins/riqor/hooks/paths";

test("parseCodexActivatorArgs parses --actions-first flag correctly", () => {
  const result = parseCodexActivatorArgs(["--actions-first", "--activator", "prompt"]);
  expect(result.actionsFirst).toBe(true);
  expect(result.activator?.enabled).toBe(true);
  expect(result.codexArgs).toEqual(["prompt"]);
});

test("buildCodexEnvironment propagates RIQOR_ACTIONS_FIRST when flag is set", () => {
  const env = buildCodexEnvironment({}, undefined, undefined, true);
  expect(env.RIQOR_ACTIONS_FIRST).toBe("1");
});

test("handleHook injects Actions-First and Ponytail YAGNI directives on SessionStart when RIQOR_ACTIONS_FIRST=1", async () => {
  const output = await handleHook(
    { hook_event_name: "SessionStart" },
    "/tmp/test-data-dir",
    { RIQOR_ACTIONS_FIRST: "1" }
  );
  const context = (output.hookSpecificOutput as any)?.additionalContext ?? "";
  expect(context).toContain("Actions-First Mode");
  expect(context).toContain("Ponytail YAGNI Filter");
});

test("handleHook injects Actions-First and Ponytail YAGNI directives on UserPromptSubmit when RIQOR_ACTIONS_FIRST=1", async () => {
  const output = await handleHook(
    { hook_event_name: "UserPromptSubmit", prompt: "build a feature" },
    "/tmp/test-data-dir",
    { RIQOR_ACTIONS_FIRST: "1" }
  );
  const context = (output.hookSpecificOutput as any)?.additionalContext ?? "";
  expect(context).toContain("Actions-First Mode");
  expect(context).toContain("Ponytail YAGNI Filter");
});

test("harnessPaths includes Ponytail YAGNI guardrails", () => {
  const archPath = harnessPaths.find((p) => p.id === "architecture-conformance");
  expect(archPath?.guardrails.some((g) => g.includes("Ponytail YAGNI"))).toBe(true);
});
