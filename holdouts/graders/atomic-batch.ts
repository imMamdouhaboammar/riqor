import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repo = resolve(process.argv[2]);
const { applyBatch } = await import(pathToFileURL(resolve(repo, "src/batch.ts")).href);
const operations = [
  { id: "one", type: "debit", cents: 40 },
  { id: "two", type: "credit", cents: 15 },
];
const snapshot = structuredClone(operations);
assert.deepEqual(applyBatch(50, operations), { balanceCents: 25, appliedIds: ["one", "two"] });
assert.deepEqual(operations, snapshot);
function rejection(operations: unknown[]) {
  const before = structuredClone(operations);
  try {
    return applyBatch(50, operations);
  } catch {
    return { balanceCents: 50, appliedIds: [] };
  } finally {
    assert.deepEqual(operations, before);
  }
}
assert.deepEqual(rejection([{ id: "x", type: "debit", cents: 60 }]), { balanceCents: 50, appliedIds: [] });
assert.deepEqual(rejection([{ id: "x", type: "credit", cents: 1 }, { id: "x", type: "credit", cents: 2 }]), { balanceCents: 50, appliedIds: [] });
assert.deepEqual(rejection([{ id: "x", type: "credit", cents: 0 }]), { balanceCents: 50, appliedIds: [] });
assert.deepEqual(rejection([{ id: "x", type: "refund", cents: 1 }]), { balanceCents: 50, appliedIds: [] });
