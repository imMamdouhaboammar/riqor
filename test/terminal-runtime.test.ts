import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyTerminalCommand,
  readTerminalState,
  recordTerminalPostexec,
  recordTerminalPreexec,
} from "../src/terminal-runtime";

describe("terminal runtime", () => {
  test("classifies mutations, checks, agents, and ordinary commands", () => {
    expect(classifyTerminalCommand("printf x > src/a.ts").kind).toBe("mutation");
    expect(classifyTerminalCommand("bun test test/a.test.ts").kind).toBe("verification");
    expect(classifyTerminalCommand("codex exec fix this").kind).toBe("agent");
    expect(classifyTerminalCommand("pwd").kind).toBe("other");
  });

  test("does not treat script names that merely contain a check word as verification", () => {
    expect(classifyTerminalCommand("bun run contest").kind).toBe("other");
    expect(classifyTerminalCommand("npm run latest").kind).toBe("other");
    expect(classifyTerminalCommand("bun run test:unit").kind).toBe("verification");
    expect(classifyTerminalCommand("npm run ci-test").kind).toBe("verification");
  });

  test("persists bounded metadata without raw commands", async () => {
    const root = await mkdtemp(join(tmpdir(), "csi-terminal-"));
    const session = "tty-test";
    const secretCommand = "printf sk-private-secret > src/a.ts";
    await recordTerminalPreexec(root, session, secretCommand, 1000);
    expect((await readTerminalState(root, session)).evidencePending).toBe(false);
    const result = await recordTerminalPostexec(root, session, 0, 1001);
    expect(result.transition).toEqual(expect.objectContaining({
      kind: "mutation",
      exitCode: 0,
      startedAt: 1000,
      completedAt: 1001,
    }));
    const state = await readTerminalState(root, session);
    expect(state.evidencePending).toBe(true);
    expect(state.lastKind).toBe("mutation");
    const stored = await readFile(join(root, `${state.sessionDigest}.json`), "utf8");
    expect(stored).not.toContain(secretCommand);
    expect(stored).not.toContain("sk-private-secret");
    expect(stored).not.toContain("transition");
    expect(state.commandDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  test("a failed mutation does not create fresh pending evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "csi-terminal-"));
    await recordTerminalPreexec(root, "s", "echo x > src/a.ts", 1000);
    const result = await recordTerminalPostexec(root, "s", 1, 1001);
    expect(result.evidencePending).toBe(false);
    expect(result.transition).toEqual(expect.objectContaining({
      kind: "mutation",
      exitCode: 1,
      startedAt: 1000,
      completedAt: 1001,
    }));
  });

  test("clears pending evidence only after a successful verification", async () => {
    const root = await mkdtemp(join(tmpdir(), "csi-terminal-"));
    await recordTerminalPreexec(root, "s", "echo x > src/a.ts", 1000);
    await recordTerminalPostexec(root, "s", 0, 1001);
    await recordTerminalPreexec(root, "s", "bun test", 1002);
    await recordTerminalPostexec(root, "s", 1, 1003);
    expect((await readTerminalState(root, "s")).evidencePending).toBe(true);
    await recordTerminalPreexec(root, "s", "bun test", 1004);
    await recordTerminalPostexec(root, "s", 0, 1005);
    expect((await readTerminalState(root, "s")).evidencePending).toBe(false);
  });

  test("does not emit a duplicate transition without pending work", async () => {
    const root = await mkdtemp(join(tmpdir(), "csi-terminal-"));
    await recordTerminalPreexec(root, "s", "pwd", 1000);
    const first = await recordTerminalPostexec(root, "s", 0, 1001);
    const repeated = await recordTerminalPostexec(root, "s", 0, 1002);
    expect(first.transition).toBeDefined();
    expect(repeated.transition).toBeUndefined();
  });

  test("formats visual terminal status badge line", () => {
    const { formatTerminalStatusLine } = require("../src/terminal-runtime");
    const formatted = formatTerminalStatusLine({
      version: 1,
      sessionDigest: "abc",
      evidencePending: true,
      commandDigest: "def",
      lastKind: "mutation",
      lastExitCode: 0,
      route: "focus",
      updatedAt: 1000,
    });
    expect(formatted).toContain("RIQOR STATUS");
    expect(formatted).toContain("MUTATION PENDING");
    expect(formatted).toContain("[Path: FOCUS]");
  });
});
