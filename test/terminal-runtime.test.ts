import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
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

  test("does not treat misleading names or non-executing check modes as verification", () => {
    expect(classifyTerminalCommand("bun run contest").kind).toBe("other");
    expect(classifyTerminalCommand("bun test --help").kind).toBe("other");
    expect(classifyTerminalCommand("npm test -- --help").kind).toBe("other");
    expect(classifyTerminalCommand("pnpm run lint -h").kind).toBe("other");
    expect(classifyTerminalCommand("yarn typecheck --version").kind).toBe("other");
    expect(classifyTerminalCommand("pytest --help").kind).toBe("other");
    expect(classifyTerminalCommand("python -m pytest --version").kind).toBe("other");
    expect(classifyTerminalCommand("git diff --check -h").kind).toBe("other");
    expect(classifyTerminalCommand("mvn -version test").kind).toBe("other");
    expect(classifyTerminalCommand("xcodebuild -version test").kind).toBe("other");
    expect(classifyTerminalCommand("phpunit -V").kind).toBe("other");
    expect(classifyTerminalCommand("npm run latest").kind).toBe("other");
    expect(classifyTerminalCommand("bun run test:unit").kind).toBe("verification");
    expect(classifyTerminalCommand("npm run ci-test").kind).toBe("verification");
  });

  test("does not accept a verification command whose failure can be masked", async () => {
    const root = await mkdtemp(join(tmpdir(), "csi-terminal-"));
    await recordTerminalPreexec(root, "s", "echo x > src/a.ts", 1000);
    await recordTerminalPostexec(root, "s", 0, 1001);
    expect(classifyTerminalCommand("bun test || true").kind).toBe("other");
    await recordTerminalPreexec(root, "s", "bun test || true", 1002);
    await recordTerminalPostexec(root, "s", 0, 1003);
    expect((await readTerminalState(root, "s")).evidencePending).toBe(true);
    expect(classifyTerminalCommand("bun test\ntrue").kind).toBe("other");
  });

  test("persists bounded metadata without raw commands", async () => {
    const root = await mkdtemp(join(tmpdir(), "csi-terminal-"));
    const session = "tty-test";
    const secretCommand = "printf sk-private-secret > src/a.ts";
    await recordTerminalPreexec(root, session, secretCommand, 1000);
    expect((await readTerminalState(root, session)).evidencePending).toBe(true);
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

  test("a failed mutation remains pending because earlier effects may have succeeded", async () => {
    const root = await mkdtemp(join(tmpdir(), "csi-terminal-"));
    await recordTerminalPreexec(root, "s", "echo x > src/a.ts", 1000);
    const result = await recordTerminalPostexec(root, "s", 1, 1001);
    expect(result.evidencePending).toBe(true);
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

  test("fails closed when an existing terminal state record is corrupt or invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "csi-terminal-"));
    const session = "corrupt-state";
    await recordTerminalPreexec(root, session, "echo x > src/a.ts", 1000);
    await recordTerminalPostexec(root, session, 0, 1001);
    const valid = await readTerminalState(root, session);
    const path = join(root, `${valid.sessionDigest}.json`);

    await writeFile(path, "{broken-json\n", "utf8");
    expect((await readTerminalState(root, session)).evidencePending).toBe(true);

    await writeFile(path, `${JSON.stringify({
      ...valid,
      evidencePending: "no",
    })}\n`, "utf8");
    expect((await readTerminalState(root, session)).evidencePending).toBe(true);
  });

  test("does not propagate unknown persisted fields", async () => {
    const root = await mkdtemp(join(tmpdir(), "csi-terminal-"));
    const session = "unknown-fields";
    const sessionDigest = createHash("sha256").update(session).digest("hex");
    const path = join(root, `${sessionDigest}.json`);
    await writeFile(path, `${JSON.stringify({
      version: 1,
      sessionDigest,
      evidencePending: false,
      commandDigest: createHash("sha256").update("").digest("hex"),
      lastKind: "other",
      lastExitCode: null,
      route: "engineering",
      updatedAt: 1000,
      rawCommand: "printf sk-private-secret > src/a.ts",
    })}\n`, "utf8");

    const state = await readTerminalState(root, session);
    expect(state.evidencePending).toBe(true);
    expect(JSON.stringify(state)).not.toContain("rawCommand");
    expect(JSON.stringify(state)).not.toContain("sk-private-secret");

    await recordTerminalPreexec(root, session, "pwd", 1001);
    const stored = await readFile(path, "utf8");
    expect(stored).not.toContain("rawCommand");
    expect(stored).not.toContain("sk-private-secret");
  });

  test("rejects pending metadata that disagrees with its top-level command", async () => {
    const root = await mkdtemp(join(tmpdir(), "csi-terminal-"));
    const session = "inconsistent-pending";
    const sessionDigest = createHash("sha256").update(session).digest("hex");
    const mutationDigest = createHash("sha256").update("mutation").digest("hex");
    const verificationDigest = createHash("sha256").update("verification").digest("hex");
    await writeFile(join(root, `${sessionDigest}.json`), `${JSON.stringify({
      version: 1,
      sessionDigest,
      evidencePending: true,
      commandDigest: mutationDigest,
      lastKind: "mutation",
      lastExitCode: null,
      route: "engineering",
      updatedAt: 1000,
      pending: {
        kind: "verification",
        route: "engineering",
        commandDigest: verificationDigest,
        startedAt: 1000,
      },
    })}\n`, "utf8");

    const result = await recordTerminalPostexec(root, session, 0, 1001);
    expect(result.evidencePending).toBe(true);
    expect(result.transition).toBeUndefined();
  });

  test("rejects a mutation intent that claims verification is clear", async () => {
    const root = await mkdtemp(join(tmpdir(), "csi-terminal-"));
    const session = "clear-mutation-pending";
    const sessionDigest = createHash("sha256").update(session).digest("hex");
    const commandDigest = createHash("sha256").update("mutation").digest("hex");
    await writeFile(join(root, `${sessionDigest}.json`), `${JSON.stringify({
      version: 1,
      sessionDigest,
      evidencePending: false,
      commandDigest,
      lastKind: "mutation",
      lastExitCode: null,
      route: "engineering",
      updatedAt: 1000,
      pending: {
        kind: "mutation",
        route: "engineering",
        commandDigest,
        startedAt: 1000,
      },
    })}\n`, "utf8");

    expect((await readTerminalState(root, session)).evidencePending).toBe(true);
  });

  test("waits for a busy state lock instead of losing a mutation", async () => {
    const root = await mkdtemp(join(tmpdir(), "csi-terminal-"));
    const session = "busy-mutation";
    const sessionDigest = createHash("sha256").update(session).digest("hex");
    const lock = join(root, `${sessionDigest}.json.lock`);
    await writeFile(lock, "held\n", { mode: 0o600 });
    const release = setTimeout(() => void rm(lock, { force: true }), 1_200);
    try {
      await recordTerminalPreexec(root, session, "printf changed > src/a.ts", 1000);
    } finally {
      clearTimeout(release);
      await rm(lock, { force: true });
    }
    expect((await readTerminalState(root, session)).evidencePending).toBe(true);
  });

  test("recovers a lock whose recorded owner is no longer alive", async () => {
    const root = await mkdtemp(join(tmpdir(), "csi-terminal-"));
    const session = "dead-lock-owner";
    const sessionDigest = createHash("sha256").update(session).digest("hex");
    const lock = join(root, `${sessionDigest}.json.lock`);
    await writeFile(lock, `${JSON.stringify({
      pid: 2_147_483_647,
      createdAt: new Date().toISOString(),
    })}\n`, { mode: 0o600 });

    await recordTerminalPreexec(root, session, "printf changed > src/a.ts", 1000);
    expect((await readTerminalState(root, session)).evidencePending).toBe(true);
  });

  test("rejects symlinked terminal state paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "csi-terminal-"));
    const outside = await mkdtemp(join(tmpdir(), "csi-terminal-outside-"));
    const session = "symlink-state";
    const sessionDigest = createHash("sha256").update(session).digest("hex");
    const target = join(outside, "target.json");
    await writeFile(target, `${JSON.stringify({
      version: 1,
      sessionDigest,
      evidencePending: false,
      commandDigest: createHash("sha256").update("").digest("hex"),
      lastKind: "other",
      lastExitCode: null,
      route: "engineering",
      updatedAt: 1000,
    })}\n`, "utf8");
    await symlink(target, join(root, `${sessionDigest}.json`));

    await expect(readTerminalState(root, session)).rejects.toThrow("unsafe symlink state path");
    expect(await readFile(target, "utf8")).toContain('"evidencePending":false');
  });

  test("uses collision-resistant atomic writes for concurrent state updates", async () => {
    const root = await mkdtemp(join(tmpdir(), "csi-terminal-"));
    await Promise.all(Array.from({ length: 16 }, (_, index) => (
      recordTerminalPreexec(root, "concurrent", `printf ${index} > src/${index}.ts`, 1000 + index)
    )));
    const state = await readTerminalState(root, "concurrent");
    expect(state.lastKind).toBe("mutation");
    expect((await readdir(root)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
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
