import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildPluginArchive, pythonSupportsCompressionLevel } from "../scripts/package-plugin";
import { inspectPlugin } from "../scripts/plugin-health";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const sha256 = async (path: string) => createHash("sha256").update(await readFile(path)).digest("hex");

describe("plugin build", () => {
  test("requires Python 3.7 or newer for deterministic compression", () => {
    expect(pythonSupportsCompressionLevel(3, 7)).toBe(true);
    expect(pythonSupportsCompressionLevel(3, 13)).toBe(true);
    expect(pythonSupportsCompressionLevel(3, 6)).toBe(false);
    expect(pythonSupportsCompressionLevel(2, 7)).toBe(false);
  });

  test("health inspection covers the manifest, hooks, skills, and privacy boundary", async () => {
    const report = await inspectPlugin(resolve(import.meta.dir, "..", "plugins", "codex-self-improvement"));
    expect(report.ok).toBe(true);
    expect(report.pluginName).toBe("codex-self-improvement");
    expect(report.hookEvents).toEqual(expect.arrayContaining(["SessionStart", "UserPromptSubmit", "PostToolUse", "Stop"]));
    expect(report.skills).toEqual(["evidence-engineering", "harness-paths", "self-improvement-loop", "universal-session-runtime"]);
    expect(report.credentialShapedFiles).toEqual([]);
    expect(report.unwantedFiles).toEqual([]);
  });

  test("builds a deterministic minimal archive", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-self-improvement-build-"));
    roots.push(root);
    const plugin = resolve(import.meta.dir, "..", "plugins", "codex-self-improvement");
    const first = join(root, "first.zip");
    const second = join(root, "second.zip");
    await buildPluginArchive(plugin, first);
    await buildPluginArchive(plugin, second);
    expect(await sha256(first)).toBe(await sha256(second));

    const listing = Bun.spawnSync(["unzip", "-Z1", first], { stdout: "pipe", stderr: "pipe" });
    expect(listing.exitCode).toBe(0);
    const entries = listing.stdout.toString().trim().split("\n");
    expect(entries).toContain(".codex-plugin/plugin.json");
    expect(entries).toContain("hooks/main.ts");
    expect(entries).toContain("skills/evidence-engineering/SKILL.md");
    expect(entries).toContain("skills/harness-paths/SKILL.md");
    expect(entries).toContain("skills/self-improvement-loop/SKILL.md");
    expect(entries).toContain("skills/universal-session-runtime/SKILL.md");
    expect(entries.some((entry) => entry.endsWith(".test.ts"))).toBe(false);
    expect(entries.some((entry) => /auth\.json|\.env(?:\.|$)|credential|secret/i.test(entry))).toBe(false);
  });
});
