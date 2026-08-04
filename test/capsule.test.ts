import { afterEach, describe, expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyTask, createCapsule, destroyCapsule, selectedCapabilities } from "../src/capsule";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("task classifier", () => {
  test("selects the database profile from task meaning", () => {
    expect(classifyTask("Repair this PostgreSQL schema and its tenant indexes")).toBe("database");
    expect(selectedCapabilities("Repair this PostgreSQL schema").map(({ name }) => name)).toEqual([
      "postgresql-table-design",
    ]);
  });

  test("selects review before the generic engineering fallback", () => {
    expect(classifyTask("Audit the previous completion claim and issue a verdict")).toBe("review");
    expect(selectedCapabilities("Audit the previous completion claim").map(({ name }) => name)).toEqual([
      "verification-before-completion",
    ]);
  });

  test("keeps the engineering fallback bounded", () => {
    expect(selectedCapabilities("Implement the parser and add regression tests").map(({ name }) => name)).toEqual([
      "test-driven-development",
      "clean-code-guard",
      "test-guard",
    ]);
  });
});

test("capsule is owner-only, links auth and selected skills, and is removable", async () => {
  const source = await mkdtemp(join(tmpdir(), "capsule-source-"));
  temporaryPaths.push(source);
  const authPath = join(source, "auth.json");
  const skillPath = join(source, "focused-skill");
  await writeFile(authPath, "secret-auth", { mode: 0o600 });
  await mkdir(skillPath);
  await writeFile(join(skillPath, "SKILL.md"), "---\nname: focused\ndescription: test\n---\n");

  const capsule = await createCapsule({ authPath, capabilities: [{ name: "focused", path: skillPath }] });
  temporaryPaths.push(capsule);
  expect((await stat(capsule)).mode & 0o777).toBe(0o700);
  expect((await lstat(join(capsule, "auth.json"))).isSymbolicLink()).toBe(true);
  expect((await lstat(join(capsule, "skills", "focused"))).isSymbolicLink()).toBe(true);
  const config = await readFile(join(capsule, "config.toml"), "utf8");
  expect(config).not.toContain("secret-auth");
  expect(config).toContain("ignore_default_excludes = false");

  await destroyCapsule(capsule);
  expect(await Bun.file(join(capsule, "config.toml")).exists()).toBe(false);
  temporaryPaths.pop();
});

test("capsule fails closed for missing auth and unsafe capability names", async () => {
  const source = await mkdtemp(join(tmpdir(), "capsule-invalid-"));
  temporaryPaths.push(source);
  const skillPath = join(source, "focused-skill");
  await mkdir(skillPath);
  await writeFile(join(skillPath, "SKILL.md"), "---\nname: focused\ndescription: test\n---\n");

  await expect(createCapsule({
    authPath: join(source, "missing-auth.json"),
    capabilities: [{ name: "focused", path: skillPath }],
  })).rejects.toThrow("invalid auth file");

  const authPath = join(source, "auth.json");
  await writeFile(authPath, "secret-auth", { mode: 0o600 });
  await expect(createCapsule({
    authPath,
    capabilities: [{ name: "../escape", path: skillPath }],
  })).rejects.toThrow("invalid capability name");
});
