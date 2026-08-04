import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const read = (path: string) => readFile(`${root}/${path}`, "utf8");

test("curated workflows preserve approval and privacy boundaries", async () => {
  const workflow = await read(".agents/skills/architecture-guardian/references/workflow.md");
  expect(workflow.indexOf("architecture policy validate")).toBeLessThan(workflow.indexOf("architecture discover"));

  const privacy = await read(".agents/skills/agency-privacy-engineer/SKILL.md");
  expect(privacy).toContain("metadata and synthetic records by default");
  expect(privacy).toContain("explicit approval before inspecting live personal data");

  const evolve = await read(".agents/skills/agent-kernel-evolve/SKILL.md");
  expect(evolve).toContain("explicit opt-in approval");
  expect(evolve).toContain("repeated failures or corrections");
  expect(evolve).toContain("non-persistent proposal");
  expect(evolve).toContain("explicit user approval before any command writes");
  for (const agent of ["Antigravity", "Claude", "Cursor", "Codex", "Gemini", "OpenCode"]) expect(evolve).toContain(agent);
});

test("curated security examples are structurally safe", async () => {
  const appsec = await read(".agents/skills/agency-application-security-engineer/SKILL.md");
  expect(appsec).toContain("/^[a-f0-9]{64}:[a-f0-9]{128}$/i");
  expect(appsec).toContain("storedBuffer.length !== 64");

  const secrets = await read(".agents/skills/agency-secrets-credential-hygiene-engineer/SKILL.md");
  expect(secrets).toContain("actions/checkout@11d5960a326750d5838078e36cf38b85af677262");
  expect(secrets).toContain("gitleaks/gitleaks-action@ff98106e4c7b2bc287b24eaf42907196329070c7");
  expect(secrets).toContain("GRANT USAGE ON SCHEMA app");
  expect(secrets).not.toContain("ON app.*");
});

test("curated observability excludes raw data and hidden reasoning", async () => {
  const multi = await read(".agents/skills/agency-multi-agent-systems-architect/SKILL.md");
  expect(multi).toContain("restricted artifact references");
  expect(multi).not.toContain("reasoning trace");
  expect(multi).not.toContain('"output": { ... }');
  expect(multi).toContain('"output_artifact_ref"');
});

test("performance and CI guidance use current metrics and pinned dependencies", async () => {
  const performance = await read(".agents/skills/agency-performance-benchmarker/SKILL.md");
  expect(performance).toContain("Interaction to Next Paint (INP ≤ 200ms at p75)");
  expect(performance).not.toContain("First Input Delay");
  expect(performance).not.toContain("FID <");

  const ci = await read(".agents/skills/architecture-guardian/references/ci-and-gates.md");
  expect(ci).toContain(".agent-kernel/architecture/change-contract.json");
  const workflow = await read(".agents/skills/architecture-guardian/templates/github-actions.yml");
  expect(workflow).toContain("actions/checkout@11d5960a326750d5838078e36cf38b85af677262");
  expect(workflow).toContain("actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020");
  expect(workflow).toContain("agent-kernel@1.19.0");
  expect(workflow).toContain("sha512-CuGiS8rgtBWdCRs/qLfN3uiKw6D19gee+Oz8UDlrgZtoY7mMlzH1+/p23Ey3olXakiqz5Yb8n1cFqcweEoMWzg==");
});

test("architecture schemas define real map and exception shapes", async () => {
  const map = JSON.parse(await read(".agents/skills/architecture-guardian/schemas/architecture-map.schema.json"));
  expect(map.required).toEqual(expect.arrayContaining(["root", "languages", "nodes", "edges", "cycles"]));
  expect(map.additionalProperties).toBe(false);
  expect(map.properties.nodes.items.required).toEqual(["file", "language", "layer", "symbols", "hash"]);
  expect(map.properties.externalImports.items.required).toEqual(["from", "language", "package", "specifier"]);

  const exceptions = JSON.parse(await read(".agents/skills/architecture-guardian/schemas/architecture-exceptions.schema.json"));
  expect(exceptions.properties.exceptions.items.anyOf).toHaveLength(2);
  expect(exceptions.properties.exceptions.items.properties.files.minItems).toBe(1);
  expect(exceptions.properties.exceptions.items["x-agent-kernel-temporal-constraints"].maximumLifetimeDays).toBe(90);
});

test("curated install is reproducible from audited revisions", async () => {
  const script = await read("scripts/install-curated-skills.sh");
  for (const commit of [
    "0a37e31d584be9050aec0d49917970f1795bde63",
    "62d620e4fc009d211dd53b34a3e722d22eb396f4",
    "2ab958093e83e0ec752e6c1c5932da465bf23e0c",
  ]) expect(script).toContain(commit);
  expect(script).toContain("--agent codex --copy -y --full-depth");
});
