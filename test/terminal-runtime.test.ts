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

  test("persists bounded metadata without raw commands", async () => {
    const root = await mkdtemp(join(tmpdir(), "csi-terminal-"));
    const session = "tty-test";
    const secretCommand = "printf sk-private-secret > src/a.ts";
    await recordTerminalPreexec(root, session, secretCommand, 1000);
    expect((await readTerminalState(root, session)).evidencePending).toBe(true);
    await recordTerminalPostexec(root, session, 0, 1001);
    const state = await readTerminalState(root, session);
    expect(state.evidencePending).toBe(true);
    expect(state.lastKind).toBe("mutation");
    const stored = await readFile(join(root, `${state.sessionDigest}.json`), "utf8");
    expect(stored).not.toContain(secretCommand);
    expect(stored).not.toContain("sk-private-secret");
    expect(state.commandDigest).toMatch(/^[a-f0-9]{64}$/);
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
});
