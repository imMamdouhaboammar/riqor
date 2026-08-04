import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repo = resolve(process.argv[2]);
const { reconcile } = await import(pathToFileURL(resolve(repo, "src/reconcile.ts")).href);
assert.deepEqual(reconcile([]), []);
const entries = [
  { account: "z", expectedCents: 5, actualCents: -2 },
  { account: "a", expectedCents: 10, actualCents: 8 },
  { account: "z", expectedCents: -3, actualCents: 4 },
];
const snapshot = structuredClone(entries);
assert.deepEqual(reconcile(entries), [
  { account: "a", expectedCents: 10, actualCents: 8 },
  { account: "z", expectedCents: 2, actualCents: 2 },
]);
assert.deepEqual(entries, snapshot);
