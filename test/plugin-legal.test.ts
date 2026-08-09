import { describe, expect, test } from "bun:test";
import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const exists = async (path: string) => { try { await access(path); return true; } catch { return false; } };

describe("public plugin legal and support pages", () => {
  test("ships concrete GitHub-hosted policy and support documents", async () => {
    for (const file of ["PRIVACY.md", "TERMS.md", "SUPPORT.md"]) {
      const path = join(root, file);
      expect(await exists(path), file).toBe(true);
      if (!(await exists(path))) continue;
      const content = await readFile(path, "utf8");
      expect(content.length, file).toBeGreaterThan(500);
      expect(content, file).not.toMatch(/\b(?:TBD|TODO|PLACEHOLDER)\b/i);
    }
  });
});
