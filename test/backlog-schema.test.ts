import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadBacklog, validateBacklog } from "../scripts/backlog-lib";
import { validateBacklogPolicy } from "../scripts/backlog-policy";

const ROOT = resolve(import.meta.dir, "..");

describe("backlog record contracts", () => {
  test("loads the seeded backlog without validation errors", async () => {
    const backlog = await loadBacklog(ROOT);
    expect(validateBacklog(backlog)).toEqual([]);
    expect(validateBacklogPolicy(backlog)).toEqual([]);
    expect(backlog.initiatives).toHaveLength(5);
    expect(backlog.items.length).toBeGreaterThanOrEqual(16);
  });

  test("ships strict JSON schemas", async () => {
    const initiativeSchema = JSON.parse(
      await readFile(join(ROOT, "schemas", "backlog-initiative.schema.json"), "utf8"),
    );
    const itemSchema = JSON.parse(
      await readFile(join(ROOT, "schemas", "backlog-item.schema.json"), "utf8"),
    );
    expect(initiativeSchema.$schema).toContain("2020-12");
    expect(itemSchema.$schema).toContain("2020-12");
    expect(initiativeSchema.additionalProperties).toBe(false);
    expect(itemSchema.additionalProperties).toBe(false);
    expect(new RegExp(initiativeSchema.properties.id.pattern).test("RIQ-099")).toBe(true);
    expect(new RegExp(itemSchema.properties.initiative.pattern).test("RIQ-099")).toBe(true);
  });

  test("keeps initiative and item IDs unique", async () => {
    const backlog = await loadBacklog(ROOT);
    const ids = [
      ...backlog.initiatives.map((initiative) => initiative.id),
      ...backlog.items.map((item) => item.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("rejects unknown fields in the runtime lint contract", async () => {
    const backlog = await loadBacklog(ROOT);
    const malformed = {
      initiatives: backlog.initiatives,
      items: [
        { ...backlog.items[0]!, unexpectedField: true },
        ...backlog.items.slice(1),
      ],
    };
    expect(validateBacklogPolicy(malformed as any))
      .toContain(expect.stringContaining("unknown item field unexpectedField"));
  });

  test("rejects initiative dependency cycles", async () => {
    const backlog = await loadBacklog(ROOT);
    const initiatives = backlog.initiatives.map((initiative) => {
      if (initiative.id === "RIQ-001") return { ...initiative, dependencies: ["RIQ-002"] };
      if (initiative.id === "RIQ-002") return { ...initiative, dependencies: ["RIQ-001"] };
      return initiative;
    });
    expect(validateBacklogPolicy({ initiatives, items: backlog.items } as any))
      .toContain(expect.stringContaining("initiative dependency cycle"));
  });

  test("requires completed dependencies before an item becomes ready", async () => {
    const backlog = await loadBacklog(ROOT);
    const items = backlog.items.map((item) =>
      item.id === "RIQ-102" ? { ...item, status: "ready" } : item,
    );
    expect(validateBacklogPolicy({ initiatives: backlog.initiatives, items } as any))
      .toContain("RIQ-102: ready requires completed dependency RIQ-101");
  });
});
