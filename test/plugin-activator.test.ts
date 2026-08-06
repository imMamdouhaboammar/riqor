import { afterEach, describe, expect, test } from "bun:test";
import { lstat, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearActivator,
  initializeActivator,
  observeActivatorStop,
  readActivatorConfig,
  touchActivator,
} from "../plugins/codex-self-improvement/hooks/activator";
import { handleHook } from "../plugins/codex-self-improvement/hooks/main";

const roots: string[] = [];
async function dataDir() {
  const root = await mkdtemp(join(tmpdir(), "riqor-activator-"));
  roots.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const config = {
  session: "2ef73b51-52d7-45c0-974f-784bcfb8ab79",
  intervalMs: 60_000,
  watchdogMs: 10_000,
} as const;
const env = {
  RIQOR_ACTIVATOR_ENABLED: "1",
  RIQOR_ACTIVATOR_SESSION: config.session,
  RIQOR_ACTIVATOR_INTERVAL_MS: String(config.intervalMs),
  RIQOR_ACTIVATOR_WATCHDOG_MS: String(config.watchdogMs),
};
const common = { session_id: "codex-session", turn_id: "turn", model: "gpt", permission_mode: "never" };

async function storedState(root: string) {
  const directory = join(root, "activator");
  const names = (await readdir(directory)).filter((name) => name.endsWith(".json"));
  expect(names).toHaveLength(1);
  return {
    name: names[0]!,
    value: JSON.parse(await readFile(join(directory, names[0]!), "utf8")),
  };
}

describe("managed Codex activator state", () => {
  test("accepts only a complete bounded managed environment", () => {
    expect(readActivatorConfig(env)).toEqual(config);
    expect(readActivatorConfig({ ...env, RIQOR_ACTIVATOR_ENABLED: "0" })).toBeUndefined();
    expect(readActivatorConfig({ ...env, RIQOR_ACTIVATOR_SESSION: "../../escape" })).toBeUndefined();
    expect(readActivatorConfig({ ...env, RIQOR_ACTIVATOR_INTERVAL_MS: "0" })).toBeUndefined();
    expect(readActivatorConfig({ ...env, RIQOR_ACTIVATOR_WATCHDOG_MS: "NaN" })).toBeUndefined();
  });

  test("stores only hashed bounded metadata", async () => {
    const root = await dataDir();
    await initializeActivator(root, config, 1_000);
    const stored = await storedState(root);
    expect(stored.name).not.toContain(config.session);
    expect(JSON.stringify(stored.value)).not.toContain(config.session);
    expect(stored.value).toMatchObject({
      version: 1,
      phase: "waiting",
      cycle: 0,
      startedAt: 1_000,
      lastActivityAt: 1_000,
      nextDueAt: 61_000,
    });
  });

  test("waits until due, blocks once, then schedules the next cycle", async () => {
    const root = await dataDir();
    await initializeActivator(root, config, 1_000);
    expect(await observeActivatorStop(root, config, 60_999, true)).toEqual({ kind: "none" });
    expect(await observeActivatorStop(root, config, 61_000, true)).toEqual({ kind: "block", cycle: 1 });
    expect(await observeActivatorStop(root, config, 65_000, true)).toEqual({ kind: "completed", cycle: 1 });
    expect(await observeActivatorStop(root, config, 65_001, true)).toEqual({ kind: "none" });
    expect((await storedState(root)).value).toMatchObject({
      phase: "waiting",
      cycle: 1,
      lastActivatedAt: 65_000,
      nextDueAt: 125_000,
    });
  });

  test("watchdog expiry fails open without a repeated block", async () => {
    const root = await dataDir();
    await initializeActivator(root, config, 0);
    expect(await observeActivatorStop(root, config, 60_000, true)).toEqual({ kind: "block", cycle: 1 });
    expect(await observeActivatorStop(root, config, 70_001, true)).toEqual({ kind: "timeout", cycle: 1 });
    expect(await observeActivatorStop(root, config, 70_002, true)).toEqual({ kind: "none" });
  });

  test("does not start a waiting cycle while a Stop hook continuation is active", async () => {
    const root = await dataDir();
    await initializeActivator(root, config, 0);
    expect(await observeActivatorStop(root, config, 60_000, false)).toEqual({ kind: "none" });
    expect(await observeActivatorStop(root, config, 60_001, true)).toEqual({ kind: "block", cycle: 1 });
  });

  test("tracks activity without retaining event contents", async () => {
    const root = await dataDir();
    await initializeActivator(root, config, 0);
    await touchActivator(root, config, 5_000);
    const stored = await storedState(root);
    expect(stored.value.lastActivityAt).toBe(5_000);
    expect(JSON.stringify(stored.value)).not.toContain("command");
  });

  test("isolates sessions and clears them independently", async () => {
    const root = await dataDir();
    const other = { ...config, session: "7540afe3-c70a-45dd-82d6-dcc5f87d5a45" };
    await initializeActivator(root, config, 0);
    await initializeActivator(root, other, 0);
    expect((await readdir(join(root, "activator"))).filter((name) => name.endsWith(".json"))).toHaveLength(2);
    await clearActivator(root, config);
    expect((await readdir(join(root, "activator"))).filter((name) => name.endsWith(".json"))).toHaveLength(1);
  });

  test("replaces malformed and hostile symlink state without touching the target", async () => {
    const root = await dataDir();
    await initializeActivator(root, config, 0);
    const directory = join(root, "activator");
    const [name] = (await readdir(directory)).filter((entry) => entry.endsWith(".json"));
    const path = join(directory, name!);
    await writeFile(path, "not-json");
    await initializeActivator(root, config, 1_000);
    expect((await storedState(root)).value.startedAt).toBe(1_000);

    const victim = join(root, "victim.txt");
    await writeFile(victim, "untouched");
    await rm(path);
    await symlink(victim, path);
    await initializeActivator(root, config, 2_000);
    expect(await readFile(victim, "utf8")).toBe("untouched");
    expect((await lstat(path)).isSymbolicLink()).toBe(false);
  });
});

describe("managed Codex activator hook integration", () => {
  test("leaves unmanaged sessions unchanged", async () => {
    const root = await dataDir();
    await handleHook({ ...common, hook_event_name: "SessionStart", source: "startup" }, root, {}, 0);
    expect(await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: false }, root, {}, 60_000)).toEqual({});
  });

  test("blocks a due managed session once and completes on the active Stop continuation", async () => {
    const root = await dataDir();
    await handleHook({ ...common, hook_event_name: "SessionStart", source: "startup" }, root, env, 0);
    const due = await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: false }, root, env, 60_000);
    expect(due).toMatchObject({ decision: "block", reason: expect.stringContaining("Riqor activator checkpoint") });
    expect(await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: true }, root, env, 65_000)).toEqual({});
    expect(await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: false }, root, env, 65_001)).toEqual({});
  });

  test("keeps the evidence gate ahead of an activator checkpoint", async () => {
    const root = await dataDir();
    await handleHook({ ...common, hook_event_name: "SessionStart", source: "startup" }, root, env, 0);
    await handleHook({
      ...common,
      hook_event_name: "PostToolUse",
      tool_name: "apply_patch",
      tool_input: { command: "*** Update File: src/a.ts" },
      tool_response: {},
    }, root, env, 60_000);
    const output = await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: false }, root, env, 60_000);
    expect(output.reason).toContain("Riqor evidence gate");
    expect(output.reason).not.toContain("activator checkpoint");
  });

  test("watchdog timeout emits a bounded message and allows completion", async () => {
    const root = await dataDir();
    await handleHook({ ...common, hook_event_name: "SessionStart", source: "startup" }, root, env, 0);
    expect(await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: false }, root, env, 60_000)).toMatchObject({ decision: "block" });
    expect(await handleHook({ ...common, hook_event_name: "Stop", stop_hook_active: true }, root, env, 70_001)).toMatchObject({
      systemMessage: expect.stringContaining("watchdog"),
    });
  });

  test("SessionEnd removes managed activator state", async () => {
    const root = await dataDir();
    await handleHook({ ...common, hook_event_name: "SessionStart", source: "startup" }, root, env, 0);
    await handleHook({ ...common, hook_event_name: "SessionEnd" }, root, env, 1);
    expect((await readdir(join(root, "activator"))).filter((name) => name.endsWith(".json"))).toHaveLength(0);
  });
});
