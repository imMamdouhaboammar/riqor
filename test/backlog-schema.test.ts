import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadBacklog, validateBacklog } from "../scripts/backlog-lib";

const ROOT = resolve(import.meta.dir, "..");

describe("backlog record contracts", () => {
  test("loads the seeded backlog without validation errors", async () => {
    const backlog = await loadBacklog(ROOT);
    expect(validateBacklog(backlog)).toEqual([]);
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
  });

  test("keeps initiative and item IDs unique", async () => {
    const backlog = await loadBacklog(ROOT);
    const ids = [
      ...backlog.initiatives.map((initiative) => initiative.id),
      ...backlog.items.map((item) => item.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
