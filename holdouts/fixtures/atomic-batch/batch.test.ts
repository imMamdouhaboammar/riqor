import { expect, test } from "bun:test";
import { applyBatch } from "./src/batch";

test("applies a valid batch in order", () => {
  expect(applyBatch(100, [
    { id: "a", type: "credit", cents: 50 },
    { id: "b", type: "debit", cents: 25 },
  ])).toEqual({ balanceCents: 125, appliedIds: ["a", "b"] });
});
