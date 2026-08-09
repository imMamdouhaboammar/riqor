import { expect, test } from "bun:test";
import { resolveCommandBrand } from "../src/command-brand";

test("uses Riqor for the public executable", () => {
  expect(resolveCommandBrand("/usr/local/bin/riqor", {})).toMatchObject({
    name: "riqor",
    displayName: "Riqor",
    compatibilityNames: ["codex-harness", "cxh", "riqor-agy", "agy-harness"],
    stateDirectoryName: "riqor",
    environmentPrefix: "RIQOR",
  });
});

test("preserves the compatibility command name", () => {
  expect(resolveCommandBrand("/usr/local/bin/codex-harness", {}).name).toBe("codex-harness");
  expect(resolveCommandBrand("/usr/local/bin/cxh", {}).name).toBe("cxh");
  expect(resolveCommandBrand("/usr/local/bin/riqor-agy", {}).name).toBe("riqor-agy");
  expect(resolveCommandBrand("/usr/local/bin/agy-harness", {}).name).toBe("agy-harness");
});

test("honors RIQOR_EXECUTABLE_NAME environment variable", () => {
  expect(resolveCommandBrand(undefined, { RIQOR_EXECUTABLE_NAME: "riqor" }).name).toBe("riqor");
});
