import { describe, expect, test } from "bun:test";
import { renderRiqorFormula } from "../scripts/generate-homebrew-formula";

describe("Homebrew Formula generation", () => {
  test("renderRiqorFormula renders a valid Homebrew Formula with Node 22 dependency", () => {
    const formula = renderRiqorFormula({
      version: "0.1.0",
      url: "https://github.com/imMamdouhaboammar/riqor/releases/download/v0.1.0/riqor-0.1.0-homebrew.tar.gz",
      sha256: "a".repeat(64),
      nodeFormula: "node@22",
    });

    expect(formula).toContain("class Riqor < Formula");
    expect(formula).toContain('depends_on "node@22"');
    expect(formula).toContain('bin.install_symlink libexec/"bin/riqor.mjs" => "riqor"');
    expect(formula).toContain('bin.install_symlink libexec/"bin/riqor.mjs" => "codex-harness"');
    expect(formula).toContain('bin.install_symlink libexec/"bin/riqor.mjs" => "cxh"');
    expect(formula).toContain('system bin/"riqor", "doctor", "--package-only", "--json"');
    expect(formula).not.toContain("shell:install");
  });

  test("rejects invalid URLs or SHA256 digests", () => {
    expect(() =>
      renderRiqorFormula({
        version: "0.1.0",
        url: "http://insecure.url/archive.tar.gz",
        sha256: "a".repeat(64),
        nodeFormula: "node@22",
      })
    ).toThrow();

    expect(() =>
      renderRiqorFormula({
        version: "0.1.0",
        url: "https://github.com/imMamdouhaboammar/riqor/archive.tar.gz",
        sha256: "invalid-sha",
        nodeFormula: "node@22",
      })
    ).toThrow();
  });
});
