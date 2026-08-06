import { describe, expect, test } from "bun:test";
import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  assertBacklogValid,
  loadBacklog,
  renderBacklogMarkdown,
  renderCurrentMarkdown,
} from "../scripts/backlog-lib";

const ROOT = resolve(import.meta.dir, "..");

describe("backlog integrity", () => {
  test("generated views match authoritative records", async () => {
    const backlog = await loadBacklog(ROOT);
    assertBacklogValid(backlog);
    expect(await readFile(join(ROOT, "BACKLOG.md"), "utf8"))
      .toBe(renderBacklogMarkdown(backlog));
    expect(await readFile(join(ROOT, "docs", "backlog", "CURRENT.md"), "utf8"))
      .toBe(renderCurrentMarkdown(backlog));
  });

  test("tracks the current trace foundation and respects WIP limits", async () => {
    const backlog = await loadBacklog(ROOT);
    const traceFoundation = backlog.items.find((item) => item.id === "RIQ-101");
    expect(traceFoundation).toEqual(expect.objectContaining({
      status: "in-progress",
      releaseTarget: "0.2.0",
      github: expect.objectContaining({ pr: 8 }),
    }));
    expect(backlog.items.filter((item) => item.status === "in-progress")).toHaveLength(1);
  });

  test("exposes repository commands for backlog maintenance", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
    expect(pkg.scripts["backlog:lint"]).toBe("bun run scripts/backlog-lint.ts");
    expect(pkg.scripts["backlog:report"]).toBe("bun run scripts/backlog-report.ts");
    expect(pkg.scripts["backlog:sync"]).toBe("bun run scripts/backlog-report.ts --write");
    expect(pkg.scripts["backlog:check"])
      .toBe("bun run backlog:lint && bun run scripts/backlog-report.ts --check");
  });

  test("ships the operating guides and issue forms", async () => {
    for (const path of [
      "docs/backlog/README.md",
      "docs/backlog/ROADMAP.md",
      "docs/backlog/TRIAGE.md",
      "docs/backlog/ECOSYSTEM_BOUNDARIES.md",
      "docs/backlog/RELEASE_TRAINS.md",
      ".github/ISSUE_TEMPLATE/initiative.yml",
      ".github/ISSUE_TEMPLATE/backlog_item.yml",
      ".github/ISSUE_TEMPLATE/phase.yml",
    ]) {
      await access(join(ROOT, path));
    }
  });
});
