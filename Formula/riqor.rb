# frozen_string_literal: true

# Riqor formula for Homebrew
class Riqor < Formula
  desc "Evidence gates and session continuity for AI coding agents"
  homepage "https://github.com/imMamdouhaboammar/riqor"
  url "https://github.com/imMamdouhaboammar/riqor/releases/download/v0.1.0/riqor-0.1.0-homebrew.tar.gz"
  version "0.1.0"
  sha256 "c17829049fc7a7d993b94790fce04d8292daac0e12664741f752a321a47161d0"
  license "MIT"

  depends_on "node@22"

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
