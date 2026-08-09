import { describe, expect, test } from "bun:test";
import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

describe("public repository surface", () => {
  test("README.md contains product structure and boundary claims", async () => {
    const readme = await readFile(join(ROOT, "README.md"), "utf8");
    expect(readme).toContain("# Riqor");
    expect(readme).toContain("Proof before done");
    expect(readme).toContain("Evidence gate");
    expect(readme).toContain("Session activator");
    expect(readme).toContain("npx riqor install");
    expect(readme).toContain("codex plugin marketplace add imMamdouhaboammar/riqor --ref main");
    expect(readme).toContain("Hosted ChatGPT conversations do not execute local Riqor code");
    expect(readme).toContain("docs/CLI_REFERENCE.md");
    expect(readme).not.toMatch(/^#{1,6}[ \t]+repository[ \t]+automation\b/im);
    expect(readme).not.toMatch(/\[[^\]]*automation[^\]]*\]\(#repository-automation\)/i);
    expect(readme).not.toMatch(/actions\/workflows\/[^\s)]+\/badge\.svg/i);
    expect(readme).not.toMatch(/github\.com\/[^\s)]+\/actions\/workflows\//i);
    expect(readme).not.toMatch(/docs\/automation\.md/i);
    expect(readme).not.toMatch(/deterministic AI|guarantees correctness/i);
  });

  test("governance files exist without placeholders", async () => {
    for (const filename of ["LICENSE", "SECURITY.md", "CONTRIBUTING.md", "CHANGELOG.md"]) {
      const content = await readFile(join(ROOT, filename), "utf8");
      expect(content).not.toContain("TODO");
      expect(content).not.toContain("YOUR_NAME");
    }
  });

  test("public documentation and preview files exist", async () => {
    for (const filename of [
      "docs/README.md",
      "docs/GETTING_STARTED.md",
      "docs/CLI_REFERENCE.md",
      "docs/ARCHITECTURE.md",
      "docs/SECURITY_MODEL.md",
      "docs/TROUBLESHOOTING.md",
      "docs/AUTOMATION.md",
      "docs/preview/index.html",
      ".autodemo.yml",
    ]) {
      await access(join(ROOT, filename));
    }
  });

  test("internal development artifacts are excluded from the release surface", async () => {
    const ignored = ["docs/superpowers/", ".planning/", "graphify-out/", "BASELINE.md", "FINAL_EVALUATION.md", "baseline-results.*", "final-results.*"];
    const gitignore = await readFile(join(ROOT, ".gitignore"), "utf8");
    for (const entry of ignored) expect(gitignore).toContain(entry);

    const tracked = spawnSync("git", ["ls-files", "docs/superpowers/**", ".planning/**", "graphify-out/**", "BASELINE.md", "FINAL_EVALUATION.md", "EVOLUTION_LOG.md", "PLUGIN_EVALUATION.md", "SKILL_CURATION.md", "baseline-results.*", "final-results.*"], { cwd: ROOT, encoding: "utf8" });
    expect(tracked.status).toBe(0);
    expect(tracked.stdout.trim()).toBe("");
  });

  test("issue and pull request templates exist", async () => {
    await access(join(ROOT, ".github", "ISSUE_TEMPLATE", "bug_report.yml"));
    await access(join(ROOT, ".github", "ISSUE_TEMPLATE", "integration_request.yml"));
    await access(join(ROOT, ".github", "ISSUE_TEMPLATE", "good_first_issue.yml"));
    await access(join(ROOT, ".github", "pull_request_template.md"));
  });
});
