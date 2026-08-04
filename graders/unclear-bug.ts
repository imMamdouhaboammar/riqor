import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repo = resolve(process.argv[2]);
const { clearCache, renderProduct } = await import(pathToFileURL(resolve(repo, "src/cache.ts")).href);
const product = { id: "p1", names: { en: "Chair", fr: "Chaise" }, tags: ["wood"] };
clearCache();
assert.equal(renderProduct(product, "en").label, "Chair");
const french = renderProduct(product, "fr");
assert.equal(french.label, "Chaise");
french.tags.push("mutated");
assert.deepEqual(renderProduct(product, "fr").tags, ["wood"]);
