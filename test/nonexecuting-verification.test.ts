import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleHook } from "../plugins/riqor/hooks/main";
import { hasNonExecutingVerificationMode } from "../plugins/riqor/hooks/verification-command";
import { completeRun, createRun, readRun } from "../src/assurance/run-store";
import { recordActiveRunTerminalTransition } from "../src/assurance/terminal-trace";
import { classifyTerminalCommand, readTerminalState, recordTerminalPostexec, recordTerminalPreexec } from "../src/terminal-runtime";

const inspectionCommands = [
  "pytest --collect-only", "pytest --co tests/test_a.py", "python -m pytest --collect-only",
  "pytest --fixtures", "pytest --funcargs", "pytest --fixtures-per-test",
  "pytest --setup-only", "pytest --setup-plan",
  "go test -list .", "go test ./... -list=Test", "go test -test.list .",
  "go test -test.list=Test", "go test -args -test.list=Test",
  "go test --list=Test", "go test --test.list=Test", "go test --args -test.list=Test",
  'go test -list "" -list Test', 'pytest "--collect-only"',
  "pytest '--co'", 'dotnet test "-t"', "go test '-list=Test'",
  "go test -list . -cpuprofile -list=", "go test -list . -args marker -test.list=",
  "go test -list . --args marker -test.list=",
  "go test -list . -args -test.cpuprofile -test.list=",
  ...["memprofile", "blockprofile", "mutexprofile", "trace", "coverprofile", "outputdir"].map(
    (flag) => `go test -list . -${flag} -list=`,
  ),
  "dotnet test --list-tests", "dotnet test -t",
];
const executingCommands = [
  "pytest tests/test_a.py", "python -m pytest -k selected", "pytest --setup-show",
  'pytest -k "selected or --collect-only"', 'pytest -k "--collect-only"',
  "pytest --ignore=--collect-only", "pytest -- --collect-only",
  'go test -run "Test-list"', 'go test -run "-list"', "go test -run=TestList",
  'go test -list ""', "go test -list=", "go test -- -list=Test",
  'go test -list Test -list ""', "go test -run -list", "go test -- -test.list=Test",
  'go test -test.run "-list"', 'dotnet test --filter "-t"',
  'pytest -k "selected or --setup-plan"', 'pytest -k "selected\\ name --co"',
  "pytest --collect-only-extra", "dotnet test --list-tests-extra", "go test -list-extra=Test",
  "go test -cpuprofile -list .", "go test -args marker -test.list=.",
  'dotnet test --filter "Name~--list-tests"', 'dotnet test --filter "--list-tests"',
  "dotnet test -- --list-tests", "cargo test --no-run", "npm test -- --dry-run",
];
const roots: string[] = [];
async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "riqor-inspection-mode-"));
  roots.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("inspection-only commands cannot supply verification evidence", () => {
  for (const command of inspectionCommands) {
    test(`rejects ${command}`, () => {
      expect(hasNonExecutingVerificationMode(command)).toBe(true);
      expect(classifyTerminalCommand(command).kind).toBe("other");
    });
  }
  for (const command of executingCommands) {
    test(`preserves ${command}`, () => {
      expect(hasNonExecutingVerificationMode(command)).toBe(false);
      expect(classifyTerminalCommand(command).kind).toBe("verification");
    });
  }
  test("keeps inspection flags scoped to their runner", () => {
    for (const command of ["bun test --collect-only", "pytest --list-tests", "go test --co"]) {
      expect(hasNonExecutingVerificationMode(command)).toBe(false);
    }
  });

  for (const command of inspectionCommands) {
    test(`terminal exit zero from ${command} leaves evidence pending`, async () => {
      const root = await temporaryRoot();
      await recordTerminalPreexec(root, "session", "echo changed > src/a.ts", 1000);
      await recordTerminalPostexec(root, "session", 0, 1001);
      await recordTerminalPreexec(root, "session", command, 1002);
      await recordTerminalPostexec(root, "session", 0, 1003);
      expect((await readTerminalState(root, "session")).evidencePending).toBe(true);
      await recordTerminalPreexec(root, "session", "pytest tests/test_a.py", 1004);
      await recordTerminalPostexec(root, "session", 0, 1005);
      expect((await readTerminalState(root, "session")).evidencePending).toBe(false);
    });

    test(`plugin exit zero from ${command} cannot unlock either Stop mode`, async () => {
      const root = await temporaryRoot();
      const common = { session_id: "session", turn_id: "turn", model: "gpt", permission_mode: "never" };
      await handleHook({ ...common, hook_event_name: "PostToolUse", tool_name: "apply_patch",
        tool_input: { command: "*** Update File: src/a.ts" }, tool_response: {} }, root, {}, 1000);
      await handleHook({ ...common, hook_event_name: "PostToolUse", tool_name: "Bash",
        tool_input: { command }, tool_response: { exit_code: 0 } }, root, {}, 1001);
      for (const stop_hook_active of [false, true]) {
        expect(await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active }, root, {}, 1002))
          .toMatchObject({ decision: "block" });
      }
      await handleHook({ ...common, hook_event_name: "PostToolUse", tool_name: "Bash",
        tool_input: { command: "pytest tests/test_a.py" }, tool_response: { exit_code: 0 } }, root, {}, 1003);
      expect(await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: true }, root, {}, 1004)).toEqual({});
    });
  }

  for (const command of ["pytest --collect-only", "go test -list .", "dotnet test --list-tests",
    "go test -list . -cpuprofile -list=", "go test -list . -args marker -test.list="]) {
    test(`assured terminal trace cannot complete after ${command}`, async () => {
      const stateRoot = await temporaryRoot();
      const terminalRoot = await temporaryRoot();
      const identity = { rootDigest: "a".repeat(64), headSha: "b".repeat(40), dirty: false, rootPath: "/fixture" };
      const options = { stateRoot, identity, runId: "run-inspection" };
      await createRun({ ...options, goal: "Reject inspection evidence", pathId: "evidence-loop",
        profileId: "assured", randomId: () => options.runId });
      const trace = async (candidate: string, startedAt: number) => {
        await recordTerminalPreexec(terminalRoot, "session", candidate, startedAt);
        const { transition } = await recordTerminalPostexec(terminalRoot, "session", 0, startedAt + 1);
        expect(transition).toBeDefined();
        await recordActiveRunTerminalTransition({ stateRoot, cwd: identity.rootPath, transition: transition!,
          locateRepository: async () => identity, inspectRepository: async () => identity, failureMode: "throw" });
      };
      await trace("echo changed > src/a.ts", 1000);
      await trace(command, 1002);
      expect((await readRun(options)).status).toBe("verification-pending");
      await expect(completeRun(options)).rejects.toThrow();
      await trace("pytest tests/test_a.py", 1004);
      expect((await completeRun(options)).status).toBe("completed");
    });
  }
});
