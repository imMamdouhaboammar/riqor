import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  initializeActivator,
  observeActivatorStop,
} from "../plugins/codex-self-improvement/hooks/activator";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const config = {
  session: "2ef73b51-52d7-45c0-974f-784bcfb8ab79",
  intervalMs: 60_000,
  watchdogMs: 10_000,
} as const;

test("a repeated SessionStart does not reset the active interval", async () => {
  const root = await mkdtemp(join(tmpdir(), "riqor-activator-resume-"));
  roots.push(root);

  await initializeActivator(root, config, 0);
  await initializeActivator(root, config, 30_000);

  expect(await observeActivatorStop(root, config, 60_000, true)).toEqual({ kind: "block", cycle: 1 });
});
