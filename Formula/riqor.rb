# frozen_string_literal: true

# Riqor formula for Homebrew
class Riqor < Formula
  desc "Evidence gates and session continuity for AI coding agents"
  homepage "https://github.com/imMamdouhaboammar/riqor"
  url "https://github.com/imMamdouhaboammar/riqor/releases/download/v0.1.0/riqor-0.1.0-homebrew.tar.gz"
  version "0.1.0"
  sha256 "a809d001397db84e08dd5beb2d63a478840dcaa5cf7e6b2f1a8548831e99147c"
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
