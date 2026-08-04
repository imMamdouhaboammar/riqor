import { expect, test } from "bun:test";
import { normalizeFilename } from "./src/filename";

test("removes path structure", () => {
  expect(normalizeFilename("../../Q4 report.csv")).toBe("Q4_report.csv");
});
