import { expect, test } from "bun:test";
import { isCorrelationId } from "./packages/contracts/correlation";

test("shared package accepts a valid correlation ID", () => {
  expect(isCorrelationId("0123456789abcdef")).toBe(true);
});
