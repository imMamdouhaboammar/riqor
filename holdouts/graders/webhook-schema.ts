import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizePostgres } from "../../graders/sql";

const repo = resolve(process.argv[2]);
const statuses = new Set(["pending", "processing", "succeeded", "failed"]);
const schema = normalizePostgres(await readFile(resolve(repo, "schema.sql"), "utf8"), statuses);
const review = (await readFile(resolve(repo, "REVIEW.md"), "utf8")).toLowerCase();
assert.match(
  schema,
  /organization_id uuid not null references organizations|foreign key\s*\(\s*organization_id\s*\)\s*references organizations/,
);
assert.match(schema, /payload jsonb not null/);
assert.match(schema, /unique\s*\(\s*organization_id\s*,\s*provider\s*,\s*event_id\s*\)/);
const statusCheck = schema.match(/check\s*\(\s*status\s+in\s*\(([^()]*)\)\s*\)/);
assert.ok(statusCheck);
assert.deepEqual(
  statusCheck[1]!.split(",").map((value) => value.trim()).sort(),
  [...statuses].map((value) => `__literal_${value}__`).sort(),
);
assert.match(schema, /attempts\s*>=\s*0/);
assert.match(schema, /organization_id\s*,\s*created_at/);
assert.match(schema, /where\s+status\s*=\s*__literal_pending__/);
for (const term of ["organization", "unique", "status", "index"]) assert.match(review, new RegExp(term));
assert.match(review, /references|foreign/);
