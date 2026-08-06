#!/usr/bin/env bash
set -euo pipefail

export HOMEBREW_NO_AUTO_UPDATE=1

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAP_DIR="/opt/homebrew/Library/Taps/immamdouhaboammar/homebrew-test-tap"

mkdir -p "$TAP_DIR/Formula"
(cd "$TAP_DIR" && git init -q 2>/dev/null || true)

cleanup() {
  echo "Cleaning up temporary Homebrew test Formula..."
  brew uninstall immamdouhaboammar/test-tap/riqor 2>/dev/null || true
  rm -rf "$TAP_DIR"
}
trap cleanup EXIT

echo "Building Homebrew archive..."
bun run scripts/build-homebrew-archive.ts

ARCHIVE_PATH="$ROOT_DIR/dist/riqor-0.1.0-homebrew.tar.gz"
SHA256="$(shasum -a 256 "$ARCHIVE_PATH" | awk '{print $1}')"

cat <<EOF > "$TAP_DIR/Formula/riqor.rb"
# frozen_string_literal: true

# Riqor formula for Homebrew
class Riqor < Formula
  desc "Evidence gates and session continuity for AI coding agents"
  homepage "https://github.com/imMamdouhaboammar/riqor"
  url "file://$ARCHIVE_PATH"
  version "0.1.0"
  sha256 "$SHA256"
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
EOF

# Hash user environment files before brew install
hash_env() {
  for f in "$HOME/.zshenv" "$HOME/.zshrc" "$HOME/.config/riqor" "$HOME/.config/kaku" "$HOME/.codex/config.toml"; do
    if [ -f "$f" ]; then
      shasum -a 256 "$f"
    elif [ -d "$f" ]; then
      find "$f" -type f -exec shasum -a 256 {} +
    else
      echo "missing:$f"
    fi
  done | shasum -a 256 | awk '{print $1}'
}

BEFORE_HASH="$(hash_env)"

echo "Testing Homebrew Formula..."
brew install immamdouhaboammar/test-tap/riqor
brew test immamdouhaboammar/test-tap/riqor

AFTER_HASH="$(hash_env)"

if [ "$BEFORE_HASH" != "$AFTER_HASH" ]; then
  echo "ERROR: brew install mutated user config files prior to explicit 'riqor install'!"
  exit 1
fi

echo "Homebrew Formula test passed with zero configuration side effects."
