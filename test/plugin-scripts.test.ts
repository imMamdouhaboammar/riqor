import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

describe("plugin operations scripts", () => {
  for (const name of ["install-plugin.sh", "uninstall-plugin.sh", "install-shell-integration.sh", "uninstall-shell-integration.sh", "install-universal.sh", "uninstall-universal.sh", "install-curated-skills.sh"]) {
    test(`${name} is valid portable shell`, async () => {
      const path = resolve(root, "scripts", name);
      const syntax = Bun.spawnSync(["bash", "-n", path], { stdout: "pipe", stderr: "pipe" });
      expect(syntax.exitCode).toBe(0);
      const contents = await readFile(path, "utf8");
      expect(contents).not.toContain("/Users/mamdouhaboammar");
      expect(contents).toContain("set -euo pipefail");
    });
  }
  test("plugin install verifies marketplace root and source", async () => {
    const contents = await readFile(resolve(root, "scripts", "install-plugin.sh"), "utf8");
    expect(contents).toContain("check-marketplace-source.py");
    expect(contents).toContain("MARKETPLACE_STATUS");
  });

  test("plugin smoke always removes its temporary auth link", async () => {
    const contents = await readFile(resolve(root, "scripts", "smoke-plugin.ts"), "utf8");
    expect(contents).toContain('const authLink = join(codexHome, "auth.json")');
    expect(contents).toContain("} finally {");
    expect(contents).toContain("await rm(authLink, { force: true })");
  });

});
