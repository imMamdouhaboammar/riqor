import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repo = resolve(process.argv[2]);
const load = (path: string) => import(pathToFileURL(resolve(repo, path)).href);
const { isCorrelationId } = await load("packages/contracts/correlation.ts");
const { apiCorrelationId } = await load("apps/api/correlation.ts");
const { cliCorrelationId } = await load("apps/cli/correlation.ts");
const valid = "0123456789abcdef";
for (const invalid of ["ABCDEF0123456789", "short", "g123456789abcdef", "0".repeat(33)]) {
  assert.equal(isCorrelationId(invalid), false);
  assert.throws(() => cliCorrelationId(invalid));
  assert.throws(() => apiCorrelationId(invalid, () => valid));
}
assert.equal(apiCorrelationId(valid, () => "f".repeat(16)), valid);
assert.equal(apiCorrelationId(undefined, () => valid), valid);
assert.equal(cliCorrelationId(valid), valid);
