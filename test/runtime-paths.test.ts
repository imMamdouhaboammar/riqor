import { describe, expect, test } from "bun:test";
import { resolveRuntimeLayout } from "../src/runtime-paths";

describe("runtime layout", () => {
  test("uses repository layout during development", () => {
    const layout = resolveRuntimeLayout({ moduleDirectory: `${process.cwd()}/src`, env: {} });
    expect(layout.distribution).toBe("repository");
    expect(layout.pluginRoot).toEndWith("plugins/codex-self-improvement");
  });

  test("uses an explicit packaged payload", () => {
    const layout = resolveRuntimeLayout({
      moduleDirectory: "/package/src",
      env: {
        RIQOR_PACKAGE_ROOT: "/package",
        RIQOR_RUNTIME_ROOT: "/package/runtime",
      },
    });
    expect(layout.distribution).toBe("package");
    expect(layout.packageJsonPath).toBe("/package/package.json");
    expect(layout.pluginRoot).toBe("/package/runtime/plugins/codex-self-improvement");
  });
});
