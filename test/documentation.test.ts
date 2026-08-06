import { describe, expect, test } from "bun:test";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

async function documentationFiles(): Promise<string[]> {
  const docs = (await readdir(join(root, "docs"), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && extname(entry.name) === ".md")
    .map((entry) => join(root, "docs", entry.name));

  return [
    join(root, "README.md"),
    join(root, "CONTRIBUTING.md"),
    join(root, "SECURITY.md"),
    join(root, "CHANGELOG.md"),
    join(root, "packages", "riqor", "README.md"),
    ...docs,
  ];
}

function localMarkdownTargets(content: string): string[] {
  const targets: string[] = [];
  const pattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of content.matchAll(pattern)) {
    const target = match[1].trim().replace(/^<|>$/g, "");
    if (!target || target.startsWith("#") || /^(?:https?:|mailto:)/.test(target)) continue;
    targets.push(target.split("#", 1)[0].split("?", 1)[0]);
  }
  return targets.filter(Boolean);
}

describe("public documentation", () => {
  test("all relative Markdown links resolve", async () => {
    for (const file of await documentationFiles()) {
      const content = await readFile(file, "utf8");
      for (const target of localMarkdownTargets(content)) {
        const resolved = resolve(dirname(file), decodeURIComponent(target));
        await access(resolved);
      }
    }
  });

  test("automation documentation matches workflow files", async () => {
    const automation = await readFile(join(root, "docs", "AUTOMATION.md"), "utf8");
    for (const workflow of ["secureai.yml", "dynamic-badges.yml", "autodemo.yml"]) {
      expect(automation).toContain(`.github/workflows/${workflow}`);
      await access(join(root, ".github", "workflows", workflow));
    }
  });

  test("assured trace foundation is documented without exposing implementation automation in the root README", async () => {
    const cli = await readFile(join(root, "docs", "CLI_REFERENCE.md"), "utf8");
    for (const command of [
      "riqor run start",
      "riqor run status",
      "riqor run complete",
      "riqor trace show",
      "riqor trace export",
    ]) {
      expect(cli).toContain(command);
    }

    const architecture = await readFile(join(root, "docs", "ARCHITECTURE.md"), "utf8");
    expect(architecture).toContain("src/assurance/run-store.ts");
    expect(architecture).toContain("events.jsonl");
    expect(architecture).toContain("verification-pending");

    const security = await readFile(join(root, "docs", "SECURITY_MODEL.md"), "utf8");
    expect(security).toContain("RIQOR_STATE_HOME");
    expect(security).toMatch(/raw command text/i);
    expect(security).toMatch(/command output/i);

    const packageReadme = await readFile(join(root, "packages", "riqor", "README.md"), "utf8");
    expect(packageReadme).toContain("riqor run start");

    const rootReadme = await readFile(join(root, "README.md"), "utf8");
    expect(rootReadme).not.toMatch(/^##\s+repository\s+automation\b/im);
    expect(rootReadme).not.toMatch(/actions\/workflows\/[^\s)]+\/badge\.svg/i);
  });

  test("visual preview has accessible product landmarks", async () => {
    const preview = await readFile(join(root, "docs", "preview", "index.html"), "utf8");
    expect(preview).toContain("<title>Riqor | Proof before done</title>");
    expect(preview).toContain('id="hero"');
    expect(preview).toContain('id="controls"');
    expect(preview).toContain('id="flow"');
    expect(preview).toContain('id="security"');
    expect(preview).toContain("npx riqor install");
  });
});
