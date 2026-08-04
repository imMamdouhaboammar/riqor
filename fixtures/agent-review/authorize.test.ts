import { expect, test } from "bun:test";
import { canAccess } from "./src/authorize";

test("member with an action is allowed", () => {
  expect(canAccess("u1", "t1", "read", [{ userId: "u1", tenantId: "t1", active: true, actions: ["read"] }])).toBe(true);
});
