import { expect, test } from "bun:test";
import { reconcile } from "./src/reconcile";

test("combines repeated accounts", () => {
  expect(reconcile([
    { account: "a", expectedCents: 100, actualCents: 90 },
    { account: "a", expectedCents: 25, actualCents: 30 },
  ])).toEqual([{ account: "a", expectedCents: 125, actualCents: 120 }]);
});
