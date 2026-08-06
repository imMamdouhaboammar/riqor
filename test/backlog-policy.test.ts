import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { loadBacklog } from "../scripts/backlog-lib";
import { validateBacklogPolicy } from "../scripts/backlog-policy";

const ROOT = resolve(import.meta.dir, "..");

function replaceItem(backlog: Awaited<ReturnType<typeof loadBacklog>>, id: string, patch: object) {
  return {
    initiatives: backlog.initiatives,
    items: backlog.items.map((item) => item.id === id ? { ...item, ...patch } : item),
  };
}

describe("backlog governance policy", () => {
  test("rejects every schema-declared duplicate array class", async () => {
    const backlog = await loadBacklog(ROOT);
    const initiative = backlog.initiatives[0]!;
    const item = backlog.items[0]!;
    const duplicateInitiative = {
      ...initiative,
      scope: {
        included: [initiative.scope.included[0]!, initiative.scope.included[0]!],
        excluded: initiative.scope.excluded,
      },
      dependencies: ["RIQ-002", "RIQ-002"],
      items: [initiative.items[0]!, initiative.items[0]!],
      releaseTargets: [initiative.releaseTargets[0]!, initiative.releaseTargets[0]!],
      successMetrics: [initiative.successMetrics[0]!, initiative.successMetrics[0]!],
      inspirations: [{ project: "internal", concepts: ["one", "one"] }],
    };
    const duplicateItem = {
      ...item,
      scope: {
        included: [item.scope.included[0]!, item.scope.included[0]!],
        excluded: [item.scope.excluded[0]!, item.scope.excluded[0]!],
      },
      dependencies: ["RIQ-102", "RIQ-102"],
      collaborators: ["agent-kernel", "agent-kernel"],
      acceptance: [
        { id: "same-check", command: "bun test" },
        { id: "same-check", command: "bun test test/other.test.ts" },
      ],
      evidenceRequired: ["focused-test", "focused-test"],
      risk: { ...item.risk, areas: [item.risk.areas[0]!, item.risk.areas[0]!] },
      inspirations: [{ project: "internal", concepts: ["one", "one"] }],
      completion: {
        mergedPr: 99,
        commit: "a".repeat(40),
        evidence: ["same-evidence", "same-evidence"],
      },
    };
    const errors = validateBacklogPolicy({
      initiatives: [duplicateInitiative, ...backlog.initiatives.slice(1)],
      items: [duplicateItem, ...backlog.items.slice(1)],
    } as any);
    for (const label of [
      "scope.included",
      "scope.excluded",
      "dependencies",
      "items",
      "releaseTargets",
      "successMetrics",
      "collaborators",
      "acceptance.id",
      "evidenceRequired",
      "risk.areas",
      "completion.evidence",
      "concepts",
    ]) {
      expect(errors.some((error) => error.includes(`duplicate ${label} value`))).toBe(true);
    }
  });

  test("returns validation errors instead of throwing for object-valued collections", async () => {
    const backlog = await loadBacklog(ROOT);
    const malformed = replaceItem(backlog, "RIQ-101", {
      dependencies: { invalid: true },
      inspirations: { invalid: true },
      acceptance: { invalid: true },
    });
    expect(() => validateBacklogPolicy(malformed as any)).not.toThrow();
    expect(validateBacklogPolicy(malformed as any))
      .toContain(expect.stringContaining("malformed backlog collection"));
  });

  test("counts distinct active pull requests by work class", async () => {
    const backlog = await loadBacklog(ROOT);
    const runtimeOverflow = {
      initiatives: backlog.initiatives,
      items: backlog.items.map((item) => {
        if (item.id === "RIQ-102") return { ...item, status: "in-progress", github: { ...item.github, pr: 90 } };
        if (item.id === "RIQ-201") return { ...item, status: "in-progress", github: { ...item.github, pr: 91 } };
        if (item.id === "RIQ-301") return { ...item, status: "in-progress", github: { ...item.github, pr: 92 } };
        return item;
      }),
    };
    expect(validateBacklogPolicy(runtimeOverflow as any))
      .toContain("WIP limit exceeded: runtime has 3 active pull requests, maximum 2");

    const sharedPullRequest = {
      initiatives: backlog.initiatives,
      items: runtimeOverflow.items.map((item) =>
        ["RIQ-102", "RIQ-201", "RIQ-301"].includes(item.id)
          ? { ...item, github: { ...item.github, pr: 90 } }
          : item,
      ),
    };
    expect(validateBacklogPolicy(sharedPullRequest as any).some(
      (error) => error.startsWith("WIP limit exceeded: runtime"),
    )).toBe(false);
  });

  test("enforces release and governance pull request limits", async () => {
    const backlog = await loadBacklog(ROOT);
    const items = backlog.items.map((item) => {
      if (item.id === "RIQ-102") {
        return { ...item, type: "release", status: "in-progress", github: { ...item.github, pr: 81 } };
      }
      if (item.id === "RIQ-201") {
        return { ...item, type: "documentation", status: "in-progress", github: { ...item.github, pr: 82 } };
      }
      if (item.id === "RIQ-301") {
        return { ...item, type: "maintenance", status: "in-progress", github: { ...item.github, pr: 83 } };
      }
      return item;
    });
    const errors = validateBacklogPolicy({ initiatives: backlog.initiatives, items } as any);
    expect(errors).toContain("WIP limit exceeded: release has 2 active pull requests, maximum 1");
    expect(errors).toContain("WIP limit exceeded: governance has 2 active pull requests, maximum 1");
  });
});
