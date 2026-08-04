import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repo = resolve(process.argv[2]);
const { canAccess } = await import(pathToFileURL(resolve(repo, "src/authorize.ts")).href);
const memberships = [
  { userId: "u1", tenantId: "t1", active: true, actions: ["read"] },
  { userId: "u2", tenantId: "t1", active: false, actions: ["read", "write"] },
];
assert.equal(canAccess(undefined, "t1", "read", memberships), false);
assert.equal(canAccess("u1", "t2", "read", memberships), false);
assert.equal(canAccess("u1", "t1", "write", memberships), false);
assert.equal(canAccess("u2", "t1", "read", memberships), false);
assert.equal(canAccess("u1", "t1", "read", memberships), true);
