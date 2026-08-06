import { describe, expect, test } from "bun:test";
import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

describe("public repository surface", () => {
  test("README.md contains public marketing structure and boundary claims", async () => {
    const readme = await readFile(join(root, "README.md"), "utf8");
    expect(readme).toContain("# Riqor");
    expect(readme).toContain("Your coding agent said it was done");
    expect(readme).toContain("Riqor checks the evidence");
    expect(readme).toContain("npx riqor install");
    expect(readme).toContain("brew install imMamdouhaboammar/tap/riqor");
    expect(readme).toContain("Hosted ChatGPT conversations do not execute local Riqor code");
    expect(readme).not.toMatch(/deterministic AI|modifies the model|guarantees correctness/i);
  });

  test("governance files exist without placeholders", async () => {
    for (const filename of ["LICENSE", "SECURITY.md", "CONTRIBUTING.md", "CHANGELOG.md"]) {
      const content = await readFile(join(root, filename), "utf8");
      expect(content).not.toContain("TODO");
      expect(content).not.toContain("YOUR_NAME");
    }
  });

  test("issue and pull request templates exist", async () => {
    await access(join(root, ".github", "ISSUE_TEMPLATE", "bug_report.yml"));
    await access(join(root, ".github", "ISSUE_TEMPLATE", "integration_request.yml"));
    await access(join(root, ".github", "ISSUE_TEMPLATE", "good_first_issue.yml"));
    await access(join(root, ".github", "pull_request_template.md"));
  });
});
