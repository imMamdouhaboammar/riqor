import { expect, test } from "bun:test";
import { coalesceWindows } from "./src/windows";

test("overlapping windows coalesce", () => {
  expect(coalesceWindows([{ start: 1, end: 4 }, { start: 3, end: 6 }])).toEqual([{ start: 1, end: 6 }]);
});
