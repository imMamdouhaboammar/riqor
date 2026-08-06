import { expect, test } from "bun:test";
import { resolveCommandBrand } from "../src/command-brand";

test("uses Riqor for the public executable", () => {
  expect(resolveCommandBrand("/usr/local/bin/riqor", {})).toMatchObject({
    name: "riqor",
    displayName: "Riqor",
    compatibilityNames: ["codex-harness", "cxh"],
    stateDirectoryName: "riqor",
    environmentPrefix: "RIQOR",
  });
});

test("preserves the compatibility command name", () => {
  expect(resolveCommandBrand("/usr/local/bin/codex-harness", {}).name).toBe("codex-harness");
  expect(resolveCommandBrand("/usr/local/bin/cxh", {}).name).toBe("cxh");
});

test("honors RIQOR_EXECUTABLE_NAME environment variable", () => {
  expect(resolveCommandBrand(undefined, { RIQOR_EXECUTABLE_NAME: "riqor" }).name).toBe("riqor");
});
