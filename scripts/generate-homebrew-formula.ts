import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type FormulaInput = Readonly<{
  version: string;
  url: string;
  sha256: string;
  nodeFormula: "node@22";
  allowLocalUrl?: boolean;
}>;

export function renderRiqorFormula(input: FormulaInput): string {
  if (!input.allowLocalUrl && !input.url.startsWith("https://")) {
    throw new Error(`Formula URL must use HTTPS: ${input.url}`);
  }

  if (!/^[a-f0-9]{64}$/i.test(input.sha256)) {
    throw new Error(`Invalid SHA256 digest (expected 64 hex characters): ${input.sha256}`);
  }

  if (!/^\d+\.\d+\.\d+$/.test(input.version)) {
    throw new Error(`Invalid version format (expected semver X.Y.Z): ${input.version}`);
  }

  return `# frozen_string_literal: true

# Riqor formula for Homebrew
class Riqor < Formula
  desc "Evidence gates and session continuity for AI coding agents"
  homepage "https://github.com/imMamdouhaboammar/riqor"
  url "${input.url}"
  version "${input.version}"
  sha256 "${input.sha256}"
  license "MIT"

  depends_on "${input.nodeFormula}"

  def install
    libexec.install Dir["*"]
    bin.install_symlink libexec/"bin/riqor.mjs" => "riqor"
    bin.install_symlink libexec/"bin/riqor.mjs" => "codex-harness"
    bin.install_symlink libexec/"bin/riqor.mjs" => "cxh"
  end

  test do
    system bin/"riqor", "version", "--json"
    system bin/"riqor", "doctor", "--package-only", "--json"
  end
end
`;
}

if (import.meta.main) {
  const version = process.env.RIQOR_VERSION ?? "0.1.0";
  const archivePath = join(process.cwd(), "dist", `riqor-${version}-homebrew.tar.gz`);
  readFile(archivePath)
    .then(async (content) => {
      const sha256 = createHash("sha256").update(content).digest("hex");
      const url = `https://github.com/imMamdouhaboammar/riqor/releases/download/v${version}/riqor-${version}-homebrew.tar.gz`;
      const formula = renderRiqorFormula({
        version,
        url,
        sha256,
        nodeFormula: "node@22",
      });
      await mkdir(join(process.cwd(), "Formula"), { recursive: true });
      await writeFile(join(process.cwd(), "Formula", "riqor.rb"), formula);
      console.log(`Generated Formula/riqor.rb (SHA256: ${sha256})`);
    })
    .catch((err) => {
      console.error(`Failed to generate Homebrew formula: ${err.message}`);
      process.exit(1);
    });
}
