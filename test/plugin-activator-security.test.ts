import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeActivator } from "../plugins/riqor/hooks/activator";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const config = {
  session: "2ef73b51-52d7-45c0-974f-784bcfb8ab79",
  intervalMs: 60_000,
  watchdogMs: 10_000,
} as const;

test("rejects a symlinked PLUGIN_DATA root", async () => {
  const root = await mkdtemp(join(tmpdir(), "riqor-activator-root-"));
  roots.push(root);
  const target = join(root, "target");
  const alias = join(root, "plugin-data");
  await mkdir(target, { mode: 0o700 });
  await symlink(target, alias);

  await expect(initializeActivator(alias, config, 0)).rejects.toThrow("PLUGIN_DATA must be a real directory");
});
