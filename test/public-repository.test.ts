import { describe, expect, test } from "bun:test";
import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

describe("public repository surface", () => {
  test("README.md contains product structure and boundary claims", async () => {
    const readme = await readFile(join(root, "README.md"), "utf8");
    expect(readme).toContain("# Riqor");
    expect(readme).toContain("Proof before done");
    expect(readme).toContain("Evidence gate");
    expect(readme).toContain("Session activator");
    expect(readme).toContain("npx riqor install");
    expect(readme).toContain("brew install imMamdouhaboammar/tap/riqor");
    expect(readme).toContain("Hosted ChatGPT conversations do not execute local Riqor code");
    expect(readme).toContain("docs/CLI_REFERENCE.md");
    expect(readme).not.toContain("## Repository Automation");
    expect(readme).not.toContain("[Automation](#repository-automation)");
    for (const workflow of ["ci.yml", "secureai.yml", "autodemo.yml"]) {
      expect(readme).not.toContain(`actions/workflows/${workflow}/badge.svg`);
    }
    expect(readme).not.toContain("docs/AUTOMATION.md");
    expect(readme).not.toMatch(/deterministic AI|guarantees correctness/i);
  });

  test("governance files exist without placeholders", async () => {
    for (const filename of ["LICENSE", "SECURITY.md", "CONTRIBUTING.md", "CHANGELOG.md"]) {
      const content = await readFile(join(root, filename), "utf8");
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
      await access(join(root, filename));
    }
  });

  test("issue and pull request templates exist", async () => {
    await access(join(root, ".github", "ISSUE_TEMPLATE", "bug_report.yml"));
    await access(join(root, ".github", "ISSUE_TEMPLATE", "integration_request.yml"));
    await access(join(root, ".github", "ISSUE_TEMPLATE", "good_first_issue.yml"));
    await access(join(root, ".github", "pull_request_template.md"));
  });
});
