import { expect, test } from "bun:test";
import { access } from "node:fs/promises";
import { resolve } from "node:path";

test("offline adoption has an isolated package module", async () => {
  const path = resolve(import.meta.dir, "..", "src", "adoption.ts");
  let present = true;
  try { await access(path); } catch { present = false; }
  expect(present).toBe(true);
});
