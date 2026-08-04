import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { harnessPaths, harnessPathForProfile } from "../plugins/codex-self-improvement/hooks/paths";

const root = resolve(import.meta.dir, "..");
const approved = new Set([
  "agency-application-security-engineer",
  "agency-multi-agent-systems-architect",
  "agency-performance-benchmarker",
  "agency-privacy-engineer",
  "agency-secrets-credential-hygiene-engineer",
  "agency-test-automation-engineer",
  "agent-kernel-evolve",
  "architecture-guardian",
  "code-review",
]);

describe("curated harness paths", () => {
  test("defines unique bounded paths with observable evidence", () => {
    const ids = harnessPaths.map((path) => path.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "architecture-conformance",
      "controlled-evolution",
      "evidence-loop",
      "independent-review",
      "privacy-minimization",
      "secure-change",
      "performance-evidence",
      "e2e-evidence",
    ]);
    for (const path of harnessPaths) {
      expect(path.objective.length).toBeGreaterThan(20);
      expect(path.evidence.length).toBeGreaterThanOrEqual(2);
      expect(path.guardrails.length).toBeGreaterThanOrEqual(2);
      expect(path.automaticActions).toEqual([]);
      for (const skill of path.curatedSkills) expect(approved.has(skill)).toBe(true);
    }
  });

  test("requires explicit approval for high-risk actions", () => {
    expect(harnessPaths.find(({ id }) => id === "controlled-evolution")?.requiresExplicitApproval)
      .toEqual(expect.arrayContaining(["publish durable memory", "install lifecycle hooks", "start a daemon"]));
    expect(harnessPaths.find(({ id }) => id === "secure-change")?.requiresExplicitApproval)
      .toEqual(expect.arrayContaining(["read live secret values", "rotate or revoke credentials", "scan an external target"]));
    expect(harnessPaths.find(({ id }) => id === "performance-evidence")?.requiresExplicitApproval)
      .toEqual(expect.arrayContaining(["run load against a shared or production target"]));
  });

  test("maps task profiles to deliberate paths", () => {
    expect(harnessPathForProfile("database").id).toBe("architecture-conformance");
    expect(harnessPathForProfile("review").id).toBe("independent-review");
    expect(harnessPathForProfile("security").id).toBe("secure-change");
    expect(harnessPathForProfile("privacy").id).toBe("privacy-minimization");
    expect(harnessPathForProfile("performance").id).toBe("performance-evidence");
    expect(harnessPathForProfile("evolution").id).toBe("controlled-evolution");
    expect(harnessPathForProfile("ui").id).toBe("e2e-evidence");
    expect(harnessPathForProfile("debugging").id).toBe("evidence-loop");
  });

  test("ships the same paths as a Codex skill", async () => {
    const definition = await readFile(
      join(root, "plugins", "codex-self-improvement", "skills", "harness-paths", "SKILL.md"),
      "utf8",
    );
    for (const path of harnessPaths) expect(definition).toContain(path.id);
    expect(definition).toContain("Never publish memory automatically");
    expect(definition).toContain("Never send repository content to an external model without explicit approval");
  });
});
