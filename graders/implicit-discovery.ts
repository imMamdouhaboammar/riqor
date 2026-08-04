import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizePostgres } from "./sql";

const repo = resolve(process.argv[2]);
const schema = normalizePostgres(await readFile(resolve(repo, "schema.sql"), "utf8"));
const review = (await readFile(resolve(repo, "REVIEW.md"), "utf8")).toLowerCase();
assert.match(schema, /foreign key|references organizations/);
assert.match(schema, /unique\s*\(\s*organization_id\s*,\s*user_id\s*\)/);
assert.match(schema, /foreign key\s*\(\s*organization_id\s*,\s*assignee_membership_id\s*\)/);
assert.match(schema, /references\s+memberships\s*\(\s*organization_id\s*,\s*id\s*\)/);
assert.match(schema, /organization_id\s*,\s*status\s*,\s*created_at\s+desc/);
for (const term of ["tenant", "foreign", "unique", "index"]) assert.match(review, new RegExp(term));
